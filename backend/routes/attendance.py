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

@attendance_bp.route('/verify-face', methods=['POST'])
@jwt_required()
def verify_face():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    captured_images = data.get('images') or []
    if not captured_images and data.get('image'):
        captured_images = [data.get('image')]

    if not captured_images:
        return jsonify({"msg": "Image is required", "verified": False}), 400

    student = Student.query.filter_by(user_id=int(user_id)).first()
    if not student:
        return jsonify({"msg": "Student record missing"}), 404

    # Fetch all stored embeddings for the scalable matching approach
    student_embs = FaceEmbedding.query.filter_by(student_id=student.id).all()
    if not student_embs and not student.reference_image_path:
        return jsonify({"msg": "No biometric profiles found for this student!"}), 404

    try:
        from flask import current_app
        from deepface import DeepFace
        from utils.face_utils import get_face_embedding

        stored_embeddings = []

        profile_image = None
        if student.reference_image_path:
            profile_image = f"{request.host_url.rstrip('/')}/uploads/{student.reference_image_path}"

        if student_embs:
            for record in student_embs:
                emb = np.array(json.loads(record.embedding), dtype=np.float32)
                emb_norm = np.linalg.norm(emb)
                if emb_norm == 0:
                    continue
                stored_embeddings.append(emb / emb_norm)
        else:
            # Backward-compatible fallback for legacy single-image enrollments
            ref_path = os.path.join(current_app.config['UPLOAD_FOLDER'], student.reference_image_path)
            res2 = DeepFace.represent(
                img_path=ref_path,
                model_name="ArcFace",
                detector_backend="retinaface",
                align=True,
                enforce_detection=False
            )
            if not res2:
                return jsonify({"msg": "Stored reference face is invalid. Re-enroll this student profile.", "verified": False}), 400

            ref_face = max(res2, key=lambda x: x["facial_area"]["w"] * x["facial_area"]["h"])
            emb = np.array(ref_face["embedding"], dtype=np.float32)
            emb_norm = np.linalg.norm(emb)
            if emb_norm == 0:
                return jsonify({"msg": "Stored reference face is corrupted. Re-enroll this student profile.", "verified": False}), 400
            stored_embeddings.append(emb / emb_norm)

        # Also compare with the latest reference image embedding so stale DB vectors don't break real users.
        if student.reference_image_path:
            ref_path = os.path.join(current_app.config['UPLOAD_FOLDER'], student.reference_image_path)
            if os.path.exists(ref_path):
                try:
                    ref_res = DeepFace.represent(
                        img_path=ref_path,
                        model_name="ArcFace",
                        detector_backend="retinaface",
                        align=True,
                        enforce_detection=False
                    )
                    if ref_res:
                        ref_face = max(ref_res, key=lambda x: x["facial_area"]["w"] * x["facial_area"]["h"])
                        ref_emb = np.array(ref_face["embedding"], dtype=np.float32)
                        ref_norm = np.linalg.norm(ref_emb)
                        if ref_norm != 0:
                            stored_embeddings.append(ref_emb / ref_norm)
                except Exception as ref_err:
                    print(f"Reference image embedding refresh warning: {ref_err}")

        if not stored_embeddings:
            return jsonify({"msg": "No usable face profiles found. Re-enroll the student face.", "verified": False}), 400

        best_distance = None
        valid_frames = 0
        frame_distances = []
        for image in captured_images:
            new_embedding, success = get_face_embedding(image)
            if not success or not new_embedding:
                frame_distances.append(None)
                continue

            new_emb = np.array(new_embedding, dtype=np.float32)
            norm = np.linalg.norm(new_emb)
            if norm == 0:
                frame_distances.append(None)
                continue
            new_emb = new_emb / norm
            frame_distance = min(float(np.linalg.norm(new_emb - emb)) for emb in stored_embeddings)
            frame_distances.append(round(frame_distance, 4))
            valid_frames += 1
            if best_distance is None or frame_distance < best_distance:
                best_distance = frame_distance

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

        # Burst verification lets us stay slightly strict while avoiding false rejects.
        l2_threshold = 1.08
        is_match = best_distance <= l2_threshold
        confidence = max(0.0, min(100.0, (1.0 - (best_distance / 1.55)) * 100.0))
        debug_data = {
            "best_distance": round(best_distance, 4),
            "threshold": l2_threshold,
            "frames_requested": len(captured_images),
            "frames_used": valid_frames,
            "stored_profiles": len(stored_embeddings),
            "frame_distances": frame_distances,
            "profile_image": profile_image
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
            "msg": f"Face mismatched (distance: {best_distance:.3f}, threshold: {l2_threshold:.2f})",
            "verified": False,
            "distance": round(best_distance, 4),
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
