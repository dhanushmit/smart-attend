from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Attendance, Student, User, Notification, FaceEmbedding
import os
import base64
import json
import numpy as np

attendance_bp = Blueprint('attendance', __name__)

# Mock college coordinates (Should be in config or admin settings)
COLLEGE_LAT = 13.0827
COLLEGE_LON = 80.2707


def _student_session_dates(student):
    if student.class_id:
        session_rows = db.session.query(Attendance.date).join(Student).filter(
            Student.class_id == student.class_id
        ).distinct().all()
    else:
        session_rows = db.session.query(Attendance.date).distinct().all()
    return sorted({row[0] for row in session_rows if row[0]}, reverse=True)


def _student_history_rows(student, limit=30):
    records = Attendance.query.filter_by(student_id=student.id).order_by(
        Attendance.date.desc(),
        Attendance.time.desc()
    ).all()
    by_date = {}
    for record in records:
        by_date.setdefault(record.date, record)

    session_dates = _student_session_dates(student)
    history = []
    for session_date in session_dates:
        record = by_date.get(session_date)
        if record:
            history.append({
                "date": record.date.strftime('%Y-%m-%d'),
                "time": record.time.strftime('%H:%M:%S') if record.time else "-",
                "status": record.status,
                "verified": record.verified
            })
        else:
            history.append({
                "date": session_date.strftime('%Y-%m-%d'),
                "time": "-",
                "status": "absent",
                "verified": False
            })
        if len(history) >= limit:
            break
    return history


def _extract_images_from_request():
    """
    Accept images via:
    - JSON: { images: [dataUrl,...] } or { image: dataUrl }
    - multipart/form-data: files 'image' / 'images', or fields 'image' / 'images' (base64/dataUrl)

    Returns a list of image sources that `utils.face_utils.get_face_embedding` can handle
    (dataUrl/base64 string OR raw bytes).
    """
    images = []

    # JSON body (preferred for mobile/webview)
    data = request.get_json(silent=True) or {}
    if isinstance(data, dict):
        body_images = data.get("images") or []
        if not body_images and data.get("image"):
            body_images = [data.get("image")]
        if isinstance(body_images, list):
            images.extend([img for img in body_images if img])
        elif body_images:
            images.append(body_images)

    # multipart/form-data (fallback)
    try:
        if request.files:
            for f in (request.files.getlist("images") or []):
                try:
                    content = f.read()
                    if content:
                        images.append(content)
                except Exception:
                    continue
            f1 = request.files.get("image")
            if f1:
                try:
                    content = f1.read()
                    if content:
                        images.append(content)
                except Exception:
                    pass

        if request.form:
            form_images = request.form.getlist("images") or []
            if not form_images and request.form.get("image"):
                form_images = [request.form.get("image")]
            for img in form_images:
                if img:
                    images.append(img)
    except Exception:
        # Keep verification robust even if request parsing is unusual.
        pass

    return images


@attendance_bp.route('/verify-face', methods=['POST'])
@jwt_required()
def verify_face():
    user_id = get_jwt_identity()
    captured_images = _extract_images_from_request()

    if not captured_images:
        return jsonify({
            "msg": "Image is required",
            "verified": False,
            "debug": {
                "content_type": request.content_type,
                "has_files": bool(request.files),
                "has_form": bool(request.form),
                "has_json": bool(request.is_json),
            }
        }), 400

    student = Student.query.filter_by(user_id=int(user_id)).first()
    if not student:
        return jsonify({"msg": "Student record missing"}), 404

    # Fetch all stored embeddings for the scalable matching approach
    student_embs = FaceEmbedding.query.filter_by(student_id=student.id).all()
    if not student_embs and not student.reference_image_path:
        return jsonify({"msg": "No biometric profiles found for this student!"}), 404

    try:
        from flask import current_app
        from utils.face_utils import get_face_embedding, get_engine_name, embedding_cosine

        engine = get_engine_name()

        stored_embeddings = []

        profile_image = None
        if getattr(student, "reference_image_blob", None) or student.reference_image_path:
            profile_image = f"{request.host_url.rstrip('/')}/public/student-photo/{student.id}"

        if student_embs:
            for record in student_embs:
                # After engine switch, old embeddings should not be compared.
                if record.engine and record.engine != engine:
                    continue
                emb = np.array(json.loads(record.embedding), dtype=np.float32)
                emb_norm = np.linalg.norm(emb)
                if emb_norm == 0:
                    continue
                stored_embeddings.append(emb / emb_norm)
        ref_emb = None
        ref_used = False

        # Always compute an embedding from the currently stored reference image.
        # This fixes "face updated but verify still fails" when DB vectors are stale.
        if student.reference_image_path:
            ref_path = os.path.join(current_app.config['UPLOAD_FOLDER'], student.reference_image_path)
            if os.path.exists(ref_path):
                ref_embedding, ref_ok = get_face_embedding(ref_path)
                if ref_ok and ref_embedding:
                    ref_emb = np.array(ref_embedding, dtype=np.float32)
                    ref_norm = np.linalg.norm(ref_emb)
                    if ref_norm != 0:
                        ref_emb = ref_emb / ref_norm
                        stored_embeddings.append(ref_emb)
                        ref_used = True

        # Auto-heal: if DB embeddings disagree strongly with the reference embedding,
        # prefer the reference embedding and refresh DB for future checks.
        refreshed_db = False
        if ref_used and student_embs:
            try:
                disagreements = [float(np.linalg.norm(ref_emb - e)) for e in stored_embeddings if e is not ref_emb]
                # If *all* DB vectors are far from the reference, they are likely stale/corrupted.
                if disagreements and min(disagreements) > 0.70:
                    stored_embeddings = [ref_emb]
                    FaceEmbedding.query.filter_by(student_id=student.id).delete()
                    db.session.add(FaceEmbedding(
                        student_id=student.id,
                        embedding=json.dumps(ref_emb.tolist()),
                        label="Auto-Heal"
                    ))
                    db.session.commit()
                    refreshed_db = True
            except Exception as heal_err:
                print(f"Auto-heal warning: {heal_err}")

        if not stored_embeddings:
            return jsonify({
                "msg": "No usable face profiles found (possibly outdated embeddings). Reset and re-enroll face.",
                "verified": False,
                "debug": {"engine": engine}
            }), 400

        best_distance = None
        best_cosine = None
        valid_frames = 0
        frame_distances = []
        frame_cosines = []
        for image in captured_images:
            new_embedding, success = get_face_embedding(image)
            if not success or not new_embedding:
                frame_distances.append(None)
                frame_cosines.append(None)
                continue

            new_emb = np.array(new_embedding, dtype=np.float32)
            norm = np.linalg.norm(new_emb)
            if norm == 0:
                frame_distances.append(None)
                continue
            new_emb = new_emb / norm
            frame_distance = min(float(np.linalg.norm(new_emb - emb)) for emb in stored_embeddings)
            # Cosine similarity against nearest stored embedding
            cosine_vals = [embedding_cosine(new_emb, emb) for emb in stored_embeddings]
            cosine_vals = [c for c in cosine_vals if c is not None]
            frame_cos = max(cosine_vals) if cosine_vals else None
            frame_distances.append(round(frame_distance, 4))
            frame_cosines.append(round(frame_cos, 4) if frame_cos is not None else None)
            valid_frames += 1
            if best_distance is None or frame_distance < best_distance:
                best_distance = frame_distance
            if frame_cos is not None and (best_cosine is None or frame_cos > best_cosine):
                best_cosine = frame_cos

        if best_distance is None or valid_frames == 0:
            return jsonify({
                "msg": "Face detection failed. Keep full face in frame and retry.",
                "verified": False,
                "debug": {
                    "frames_requested": len(captured_images),
                    "frames_used": valid_frames,
                    "stored_profiles": len(stored_embeddings),
                    "frame_distances": frame_distances,
                    "profile_image": profile_image
                }
            }), 400

        # Engine-specific thresholds:
        # - OpenCV SFace: cosine similarity is stable (higher is better).
        # - DeepFace ArcFace: keep L2 threshold (lower is better).
        if engine == "opencv":
            cos_threshold = 0.35
            support_votes = sum(1 for c in frame_cosines if isinstance(c, (int, float)) and c >= cos_threshold)
            is_match = (best_cosine is not None and best_cosine >= cos_threshold) and (support_votes >= 2 or valid_frames <= 1)
            confidence = max(0.0, min(100.0, (best_cosine or 0.0) * 100.0))
            debug_data = {
                "engine": engine,
                "best_cosine": round(best_cosine, 4) if best_cosine is not None else None,
                "threshold": cos_threshold,
                "support_votes": support_votes,
                "frames_requested": len(captured_images),
                "frames_used": valid_frames,
                "stored_profiles": len(stored_embeddings),
                "frame_cosines": frame_cosines,
                "frame_distances": frame_distances,
                "profile_image": profile_image,
                "reference_used": ref_used,
                "db_refreshed": refreshed_db
            }
        else:
            l2_threshold = 1.15
            support_threshold = 1.22
            valid_distances = [d for d in frame_distances if isinstance(d, (int, float))]
            support_votes = sum(1 for d in valid_distances if d <= support_threshold)
            is_match = (best_distance <= l2_threshold) and (support_votes >= 2 or valid_frames <= 1)
            confidence = max(0.0, min(100.0, (1.0 - (best_distance / 1.55)) * 100.0))
            debug_data = {
                "engine": engine,
                "best_distance": round(best_distance, 4),
                "threshold": l2_threshold,
                "support_threshold": support_threshold,
                "support_votes": support_votes,
                "frames_requested": len(captured_images),
                "frames_used": valid_frames,
                "stored_profiles": len(stored_embeddings),
                "frame_distances": frame_distances,
                "profile_image": profile_image,
                "reference_used": ref_used,
                "db_refreshed": refreshed_db
            }

        if is_match:
            return jsonify({
                "msg": f"Verified ({confidence:.0f}%)",
                "verified": True,
                "distance": round(best_distance, 4),
                "frames_used": valid_frames,
                "debug": debug_data
            }), 200

        return jsonify({
            "msg": "Face mismatched",
            "verified": False,
            "distance": round(best_distance, 4) if best_distance is not None else None,
            "cosine": round(best_cosine, 4) if best_cosine is not None else None,
            "frames_used": valid_frames,
            "debug": debug_data
        }), 400

    except ValueError:
        return jsonify({"msg": "Face detection failed! Check lighting.", "verified": False}), 400
    except Exception as e:
        print(f"Face verification error: {e}")
        return jsonify({"msg": "Verification error", "verified": False}), 500

@attendance_bp.route('/mark', methods=['POST'])
@jwt_required()
def mark_attendance():
    user_id = get_jwt_identity()

    student = Student.query.filter_by(user_id=int(user_id)).first()
    if not student:
        return jsonify({"msg": "Student record not found"}), 404

    # LIMIT CHECK: Reverted to 2 times per day
    from datetime import datetime
    today = datetime.utcnow().date()
    today_count = Attendance.query.filter_by(
        student_id=student.id,
        date=today
    ).count()

    if today_count >= 2:
        return jsonify({
            "msg": "Already marked for today (Daily limit 2 reached).",
            "count": today_count
        }), 403

    try:
        new_attendance = Attendance(
            student_id=student.id,
            status='present',
            verified=True,
            date=today,
            time=datetime.utcnow()
        )
        db.session.add(new_attendance)
        db.session.commit()
        return jsonify({"msg": "Attendance marked successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Database error: {str(e)}"}), 500


def _is_admin_or_advisor(user_id):
    user = User.query.get(int(user_id))
    return user and user.role in ("admin", "advisor")


@attendance_bp.route('/identify', methods=['POST'])
@jwt_required()
def identify_student():
    """Admin/Advisor kiosk: identify a student from a face scan and optionally mark attendance."""
    user_id = get_jwt_identity()
    if not _is_admin_or_advisor(user_id):
        return jsonify({"msg": "Admin/Advisor access required"}), 403

    data = request.get_json(silent=True) or {}
    captured_images = _extract_images_from_request()

    if not captured_images:
        return jsonify({
            "msg": "Image is required",
            "debug": {
                "content_type": request.content_type,
                "has_files": bool(request.files),
                "has_form": bool(request.form),
                "has_json": bool(request.is_json),
            }
        }), 400

    from datetime import datetime
    from utils.face_utils import get_face_embedding, get_engine_name, embedding_cosine

    engine = get_engine_name()

    # Load all known embeddings (small demo DB; OK to do in-memory).
    emb_rows = FaceEmbedding.query.all()
    if not emb_rows:
        return jsonify({"msg": "No enrolled biometrics found"}), 404

    known = []
    for row in emb_rows:
        try:
            if row.engine and row.engine != engine:
                continue
            e = np.array(json.loads(row.embedding), dtype=np.float32)
            n = np.linalg.norm(e)
            if n == 0:
                continue
            known.append((row.student_id, e / n))
        except Exception:
            continue

    if not known:
        return jsonify({"msg": "No usable biometrics found"}), 404

    best = None  # (distance, cosine, student_id)
    frames_used = 0
    frame_distances = []
    frame_cosines = []
    for img in captured_images:
        emb, ok = get_face_embedding(img)
        if not ok or not emb:
            frame_distances.append(None)
            frame_cosines.append(None)
            continue
        q = np.array(emb, dtype=np.float32)
        qn = np.linalg.norm(q)
        if qn == 0:
            frame_distances.append(None)
            continue
        q = q / qn
        frames_used += 1

        # Find nearest across all students.
        nearest = min((float(np.linalg.norm(q - kemb)), float(np.dot(q, kemb)), sid) for (sid, kemb) in known)
        frame_distances.append(round(nearest[0], 4))
        frame_cosines.append(round(nearest[1], 4))
        if best is None or nearest[0] < best[0]:
            best = (nearest[0], nearest[1], nearest[2])

    if best is None or frames_used == 0:
        return jsonify({
            "msg": "Face detection failed. Keep full face in frame and retry.",
            "debug": {
                "frames_requested": len(captured_images),
                "frames_used": frames_used,
                "frame_distances": frame_distances
            }
        }), 400

    best_distance, best_cosine, best_student_id = best
    if engine == "opencv":
        threshold = 0.35  # cosine
        is_match = best_cosine >= threshold
    else:
        threshold = 1.15  # L2
        is_match = best_distance <= threshold

    student = Student.query.get(int(best_student_id))
    if not student or not student.user:
        return jsonify({"msg": "Matched student record missing"}), 404

    result = {
        "matched": bool(is_match),
        "distance": round(best_distance, 4),
        "cosine": round(best_cosine, 4),
        "threshold": threshold,
        "frames_used": frames_used,
        "student": {
            "id": student.id,
            "fullname": student.user.fullname,
            "roll_no": student.roll_no,
            "username": student.user.username,
            "class_name": student.student_class.name if student.student_class else None
        },
        "debug": {
            "engine": engine,
            "frames_requested": len(captured_images),
            "frame_distances": frame_distances,
            "frame_cosines": frame_cosines,
            "candidates": len(known)
        }
    }

    if not is_match:
        result["msg"] = "No confident match"
        return jsonify(result), 400

    # Optional mark attendance (default true for kiosk).
    mark = data.get("mark", True)
    if not mark:
        result["msg"] = "Matched"
        return jsonify(result), 200

    today = datetime.utcnow().date()
    exists = Attendance.query.filter_by(student_id=student.id, date=today, status='present').first()
    if exists:
        result["msg"] = "Already marked today"
        result["already_marked"] = True
        return jsonify(result), 200

    try:
        db.session.add(Attendance(
            student_id=student.id,
            status='present',
            verified=True,
            date=today,
            time=datetime.utcnow()
        ))
        db.session.commit()
        result["msg"] = "Marked present"
        result["already_marked"] = False
        return jsonify(result), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Database error: {str(e)}"}), 500

@attendance_bp.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    user_id = get_jwt_identity()
    student = Student.query.filter_by(user_id=int(user_id)).first()

    if not student:
        return jsonify({"message": "Student not found"}), 404

    return jsonify(_student_history_rows(student, limit=30)), 200

@attendance_bp.route('/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    user_id = get_jwt_identity()
    alerts = Notification.query.filter_by(user_id=int(user_id)).order_by(Notification.created_at.desc()).limit(10).all()

    result = [{
        "id": a.id,
        "message": a.message,
        "type": a.type,
        "date": a.created_at.strftime('%Y-%m-%d %H:%M')
    } for a in alerts]

    # Add a mock alert if empty just for UI demo
    if not result:
        result = [{
            "id": 0,
            "message": "Welcome to the Smart Attendance System! Ensure your GPS is on before marking.",
            "type": "info",
            "date": "Just now"
        }]
    
    return jsonify(result), 200


@attendance_bp.route('/alerts/unread-count', methods=['GET'])
@jwt_required()
def get_unread_alert_count():
    user_id = get_jwt_identity()
    count = Notification.query.filter_by(user_id=int(user_id), is_read=False).count()
    return jsonify({"count": count}), 200


@attendance_bp.route('/alerts/mark-read', methods=['POST'])
@jwt_required()
def mark_alerts_read():
    user_id = get_jwt_identity()
    Notification.query.filter_by(user_id=int(user_id), is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"msg": "Alerts marked as read"}), 200

@attendance_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user_id = get_jwt_identity()
    student = Student.query.filter_by(user_id=int(user_id)).first()
    if not student:
        return jsonify({"present": 0, "absent": 0}), 404

    session_dates = _student_session_dates(student)
    present_rows = db.session.query(Attendance.date).filter_by(
        student_id=student.id,
        status='present'
    ).distinct().all()
    present = len({row[0] for row in present_rows if row[0]})
    absent = max(len(session_dates) - present, 0)

    return jsonify({
        "present": present,
        "absent": absent,
        "total_sessions": len(session_dates),
        "attendance_pct": round((present / len(session_dates)) * 100, 2) if session_dates else 0
    })
