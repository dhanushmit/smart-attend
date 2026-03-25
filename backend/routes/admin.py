from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Student, Attendance, Class, Notification, FaceEmbedding
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import os
import json
import io
import pandas as pd
import base64
from utils.face_utils import get_face_embedding, crop_and_zoom_face, embedding_distance
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph

admin_bp = Blueprint('admin', __name__)
API_BASE_URL = "http://127.0.0.1:5000"
DUPLICATE_FACE_THRESHOLD = 0.80


def _all_session_dates(class_id=None):
    query = db.session.query(Attendance.date).distinct()
    if class_id:
        query = query.join(Student).filter(Student.class_id == class_id)
    return sorted({row[0] for row in query.all() if row[0]})


def _present_date_count(student_id):
    rows = db.session.query(Attendance.date).filter_by(
        student_id=student_id,
        status='present'
    ).distinct().all()
    return len({row[0] for row in rows if row[0]})


def _student_metrics(student):
    session_dates = _all_session_dates(student.class_id)
    present = _present_date_count(student.id)
    absent = max(len(session_dates) - present, 0)
    attendance_pct = round((present / len(session_dates)) * 100, 2) if session_dates else 0
    return {
        "present": present,
        "absent": absent,
        "attendance_pct": attendance_pct,
        "total_sessions": len(session_dates)
    }


def _attendance_rows(filter_type="all", class_id=None):
    now = datetime.utcnow()
    session_dates = _all_session_dates(class_id)

    if filter_type == 'daily':
        session_dates = [d for d in session_dates if d == now.date()]
    elif filter_type == 'weekly':
        one_week_ago = now.date() - timedelta(days=7)
        session_dates = [d for d in session_dates if d >= one_week_ago]
    elif filter_type == 'monthly':
        one_month_ago = now.date() - timedelta(days=30)
        session_dates = [d for d in session_dates if d >= one_month_ago]

    students_query = Student.query
    if class_id:
        students_query = students_query.filter_by(class_id=class_id)
    students = students_query.all()

    rows = []
    for student in students:
        records = Attendance.query.filter_by(student_id=student.id).filter(
            Attendance.date.in_(session_dates)
        ).order_by(Attendance.date.desc(), Attendance.time.desc()).all()
        by_date = {}
        for record in records:
            by_date.setdefault(record.date, record)

        for session_date in sorted(session_dates, reverse=True):
            record = by_date.get(session_date)
            rows.append({
                "id": f"{student.id}-{session_date.isoformat()}",
                "student_name": student.user.fullname,
                "roll_no": student.roll_no,
                "class_name": student.student_class.name if student.student_class else "Unassigned",
                "advisor_name": student.student_class.advisor.fullname if student.student_class and student.student_class.advisor else "Unassigned",
                "date": session_date.isoformat(),
                "time": record.time.strftime("%H:%M:%S") if record and record.time else "-",
                "status": record.status if record else "absent",
                "verified": bool(record.verified) if record else False,
                "location": f"{record.gps_lat}, {record.gps_long}" if record and record.gps_lat is not None and record.gps_long is not None else "N/A"
            })
    return rows


def _attendance_summary(rows):
    total = len(rows)
    present = sum(1 for row in rows if row["status"] == "present")
    absent = sum(1 for row in rows if row["status"] == "absent")
    verified = sum(1 for row in rows if row["verified"])
    return {
        "total": total,
        "present": present,
        "absent": absent,
        "verified": verified
    }


def _export_table_rows(rows):
    export_rows = []
    for idx, row in enumerate(rows, start=1):
        export_rows.append({
            "S.No": idx,
            "Student Name": row["student_name"],
            "Roll No": row["roll_no"],
            "Class": row["class_name"],
            "Advisor": row["advisor_name"],
            "Date": row["date"],
            "Time": row["time"],
            "Status": row["status"].capitalize(),
            "Verified": "Yes" if row["verified"] else "No",
        })
    return export_rows


def _build_pdf_report(rows, filter_type):
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=20, rightMargin=20, topMargin=20, bottomMargin=20)
    styles = getSampleStyleSheet()
    summary = _attendance_summary(rows)
    export_rows = _export_table_rows(rows)

    elements = [
        Paragraph(f"Attendance Report - {filter_type.title()}", styles["Title"]),
        Spacer(1, 8),
        Paragraph(
            f"Total Rows: {summary['total']} | Present: {summary['present']} | Absent: {summary['absent']} | Verified: {summary['verified']}",
            styles["Heading3"]
        ),
        Spacer(1, 12),
    ]

    table_data = [[
        "S.No", "Student Name", "Roll No", "Class", "Advisor", "Date", "Time", "Status", "Verified"
    ]]
    for row in export_rows:
        table_data.append([
            row["S.No"],
            row["Student Name"],
            row["Roll No"],
            row["Class"],
            row["Advisor"],
            row["Date"],
            row["Time"],
            row["Status"],
            row["Verified"],
        ])

    table = Table(table_data, repeatRows=1, colWidths=[35, 120, 70, 90, 100, 75, 55, 60, 55])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
    ]))
    elements.append(table)
    doc.build(elements)
    output.seek(0)
    return output


def _find_duplicate_face(candidate_embedding, exclude_student_id=None):
    all_embeddings = FaceEmbedding.query.all()
    for stored in all_embeddings:
        if exclude_student_id and stored.student_id == exclude_student_id:
            continue
        stored_embedding = json.loads(stored.embedding)
        dist = embedding_distance(candidate_embedding, stored_embedding)
        if dist is not None and dist <= DUPLICATE_FACE_THRESHOLD:
            duplicate_student = Student.query.get(stored.student_id)
            if duplicate_student:
                return duplicate_student, dist
    return None, None


def _ensure_class(class_id=None, class_name=None, advisor_id=None):
    if class_id:
        cls = Class.query.get(class_id)
        if not cls:
            return None, "Selected class not found."
        if advisor_id is not None:
            cls.advisor_id = advisor_id or None
        return cls, None

    clean_name = (class_name or "").strip()
    if not clean_name:
        return None, None

    cls = Class.query.filter_by(name=clean_name).first()
    if not cls:
        cls = Class(name=clean_name, advisor_id=advisor_id or None)
        db.session.add(cls)
        db.session.flush()
    elif advisor_id is not None:
        cls.advisor_id = advisor_id or None

    return cls, None

@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        return jsonify({"msg": "Admin access required"}), 403
    
    total_students = Student.query.count()
    total_advisors = User.query.filter_by(role='advisor').count()
    total_attendance = Attendance.query.count()
    total_classes = Class.query.count()
    session_dates = _all_session_dates()
    verified_count = Attendance.query.filter_by(verified=True).count()
    present_count = Attendance.query.filter_by(status='present').count()
    present_rate = round((present_count / total_attendance) * 100, 2) if total_attendance else 0
    verified_rate = round((verified_count / total_attendance) * 100, 2) if total_attendance else 0
    
    return jsonify({
        "total_students": total_students,
        "total_advisors": total_advisors,
        "total_attendance": total_attendance,
        "total_classes": total_classes,
        "active_sessions": len(session_dates),
        "api_load": verified_rate,
        "present_rate": present_rate,
        "verified_rate": verified_rate
    })


@admin_bp.route('/classes', methods=['GET', 'POST'])
@jwt_required()
def manage_classes():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        return jsonify({"msg": "Admin access required"}), 403

    if request.method == 'GET':
        classes = Class.query.order_by(Class.name.asc()).all()
        return jsonify([{
            "id": cls.id,
            "name": cls.name,
            "advisor_id": cls.advisor_id,
            "advisor_name": cls.advisor.fullname if cls.advisor else None,
            "student_count": Student.query.filter_by(class_id=cls.id).count()
        } for cls in classes])

    data = request.get_json() or {}
    name = (data.get('name') or "").strip()
    if not name:
        return jsonify({"msg": "Class name is required"}), 400
    if Class.query.filter_by(name=name).first():
        return jsonify({"msg": "Class already exists"}), 400

    new_class = Class(name=name, advisor_id=data.get('advisor_id') or None)
    db.session.add(new_class)
    db.session.commit()
    return jsonify({"msg": "Class created successfully", "id": new_class.id}), 201


@admin_bp.route('/classes/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def update_delete_class(id):
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        return jsonify({"msg": "Admin access required"}), 403

    cls = Class.query.get_or_404(id)
    if request.method == 'DELETE':
        Student.query.filter_by(class_id=cls.id).update({"class_id": None})
        db.session.delete(cls)
        db.session.commit()
        return jsonify({"msg": "Class deleted"})

    data = request.get_json() or {}
    name = (data.get('name') or cls.name).strip()
    existing = Class.query.filter(Class.name == name, Class.id != cls.id).first()
    if existing:
        return jsonify({"msg": "Another class already uses this name"}), 400

    cls.name = name
    cls.advisor_id = data.get('advisor_id') or None
    db.session.commit()
    return jsonify({"msg": "Class updated"})

@admin_bp.route('/students', methods=['GET', 'POST'])
@jwt_required()
def manage_students():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        return jsonify({"msg": "Admin access required"}), 403

    if request.method == 'GET':
        students = Student.query.all()
        result = []
        for s in students:
            image_url = f"{API_BASE_URL}/uploads/{s.reference_image_path}" if s.reference_image_path else None
            metrics = _student_metrics(s)
            result.append({
                "id": s.id,
                "user_id": s.user_id,
                "username": s.user.username,
                "fullname": s.user.fullname,
                "email": s.user.email,
                "roll_no": s.roll_no,
                "class_id": s.class_id,
                "class_name": s.student_class.name if s.student_class else "Unassigned",
                "advisor_name": s.student_class.advisor.fullname if s.student_class and s.student_class.advisor else "Unassigned",
                "image": image_url,
                "attendance_pct": metrics["attendance_pct"],
                "present": metrics["present"],
                "absent": metrics["absent"]
            })
        return jsonify(result)

    if request.method == 'POST':
        data = request.get_json() or {}
        images = data.get('images', [])
        
        if User.query.filter_by(username=data.get('username')).first():
            return jsonify({"msg": "Username already exists"}), 400
        if data.get('email') and User.query.filter_by(email=data.get('email')).first():
            return jsonify({"msg": "Email already exists"}), 400
        if Student.query.filter_by(roll_no=data.get('roll_no')).first():
            return jsonify({"msg": "Roll number already exists"}), 400
        if not images:
            return jsonify({"msg": "At least one face capture is required"}), 400

        class_id = data.get('class_id')
        if class_id:
            cls = Class.query.get(class_id)
            if not cls:
                return jsonify({"msg": "Selected class not found"}), 400

        new_user = User(
            username=data['username'],
            password_hash=generate_password_hash(data.get('password', 'password123')),
            role='student',
            fullname=data.get('fullname'),
            email=data.get('email')
        )
        db.session.add(new_user)
        db.session.flush()

        new_student = Student(
            user_id=new_user.id,
            roll_no=data['roll_no'],
            class_id=class_id if class_id else None,
            reference_image_path=None
        )
        db.session.add(new_student)
        db.session.flush()
        
        saved_embeddings = 0
        main_filename = None
        
        for i, img_b64 in enumerate(images):
            embedding, success = get_face_embedding(img_b64)
            if success:
                duplicate_student, duplicate_distance = _find_duplicate_face(embedding)
                if duplicate_student:
                    db.session.rollback()
                    return jsonify({
                        "msg": f"Duplicate face detected. This face is already enrolled for {duplicate_student.user.fullname} ({duplicate_student.roll_no}).",
                        "distance": round(duplicate_distance, 4)
                    }), 400

                new_emb = FaceEmbedding(
                    student_id=new_student.id,
                    embedding=json.dumps(embedding),
                    label=f"Capture {i+1}"
                )
                db.session.add(new_emb)
                saved_embeddings = int(saved_embeddings) + 1
                
                if i == 0 or main_filename is None:
                    face_bytes, crop_success = crop_and_zoom_face(img_b64)
                    if crop_success:
                        main_filename = f"students/{new_user.id}_profile.jpg"
                        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], main_filename)
                        os.makedirs(os.path.dirname(file_path), exist_ok=True)
                        with open(file_path, "wb") as f:
                            f.write(face_bytes)

        if saved_embeddings == 0:
            db.session.rollback()
            return jsonify({"msg": "Enrollment Failed: No clear faces detected in your captures! Please try again with better lighting."}), 400

        try:
            new_student.reference_image_path = main_filename
            db.session.commit()
            return jsonify({"msg": f"Student created with {saved_embeddings} biometric profiles."}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"msg": f"Database error: {str(e)}"}), 500

@admin_bp.route('/students/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def update_delete_student(id):
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        return jsonify({"msg": "Admin access required"}), 403
    
    student = Student.query.get_or_404(id)
    if request.method == 'DELETE':
        user_to_del = User.query.get(student.user_id)
        db.session.delete(student)
        db.session.delete(user_to_del)
        db.session.commit()
        return jsonify({"msg": "Student deleted"})
    
    if request.method == 'PUT':
        # Handle both JSON and Multipart
        if request.content_type.startswith('multipart/form-data'):
            data = request.form
            file = request.files.get('image')
        else:
            data = request.json
            file = None

        user = student.user
        if data.get('username') and data.get('username') != user.username:
            if User.query.filter(User.username == data.get('username'), User.id != user.id).first():
                return jsonify({"msg": "Username already exists"}), 400
        if data.get('email') and data.get('email') != user.email:
            if User.query.filter(User.email == data.get('email'), User.id != user.id).first():
                return jsonify({"msg": "Email already exists"}), 400
        if data.get('roll_no') and data.get('roll_no') != student.roll_no:
            if Student.query.filter(Student.roll_no == data.get('roll_no'), Student.id != student.id).first():
                return jsonify({"msg": "Roll number already exists"}), 400

        user.fullname = data.get('fullname', user.fullname)
        user.email = data.get('email', user.email)
        user.username = data.get('username', user.username)
        
        if 'password' in data and data['password']:
            user.password_hash = generate_password_hash(data['password'])
            
        student.roll_no = data.get('roll_no', student.roll_no)
        if 'class_id' in data:
            student.class_id = data.get('class_id') or None
        
        img_data = data.get('image') if not file else None
        if file or img_data:
            filename = f"students/{user.id}_update_{int(datetime.utcnow().timestamp())}.jpg"
            from flask import current_app
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            
            # Ensure student folder exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            if file:
                file.save(file_path)
            else:
                import base64
                if img_data and isinstance(img_data, str):
                    if ',' in img_data:
                        img_data = img_data.split(',')[1]
                    with open(file_path, "wb") as f:
                        f.write(base64.b64decode(img_data))

            # Remove old image if exists
            if student.reference_image_path:
                old_path = os.path.join(current_app.config['UPLOAD_FOLDER'], student.reference_image_path)
                if os.path.exists(old_path) and not os.path.isdir(old_path):
                    try: os.remove(old_path)
                    except: pass
            
            student.reference_image_path = filename
            
        db.session.commit()
        return jsonify({"msg": "Student updated successfully"})

@admin_bp.route('/students/<int:id>/face', methods=['POST'])
@jwt_required()
def update_student_face(id):
    from models import FaceEmbedding

    student = Student.query.get_or_404(id)
    data = request.json
    captured_img_base64 = data.get('image')
    
    if not captured_img_base64:
        return jsonify({"msg": "No image data"}), 400

    try:
        from utils.face_utils import crop_and_zoom_face, get_face_embedding

        embedding, embedding_ok = get_face_embedding(captured_img_base64)
        face_bytes, crop_success = crop_and_zoom_face(captured_img_base64)

        if not embedding_ok or not crop_success:
            return jsonify({"msg": "No face detected in capture. Face not updated."}), 400

        duplicate_student, duplicate_distance = _find_duplicate_face(embedding, exclude_student_id=student.id)
        if duplicate_student:
            return jsonify({
                "msg": f"Duplicate face detected. This face is already enrolled for {duplicate_student.user.fullname} ({duplicate_student.roll_no}).",
                "distance": round(duplicate_distance, 4)
            }), 400

        filename = f"students/{student.user_id}_face_{int(datetime.utcnow().timestamp())}.jpg"
        final_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        os.makedirs(os.path.dirname(final_path), exist_ok=True)

        with open(final_path, "wb") as f:
            f.write(face_bytes)

        if student.reference_image_path:
            old_path = os.path.join(current_app.config['UPLOAD_FOLDER'], student.reference_image_path)
            if os.path.exists(old_path) and not os.path.isdir(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    pass

        # Replace old embeddings so verification uses the latest enrolled face.
        FaceEmbedding.query.filter_by(student_id=student.id).delete()
        db.session.add(FaceEmbedding(
            student_id=student.id,
            embedding=json.dumps(embedding),
            label="Face Update"
        ))

        student.reference_image_path = filename
        db.session.commit()
        return jsonify({"msg": "Face profile updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Face processing error: {str(e)}"}), 500

@admin_bp.route('/advisors', methods=['GET', 'POST'])
@jwt_required()
def manage_advisors():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        return jsonify({"msg": "Admin access required"}), 403

    if request.method == 'GET':
        advisors = User.query.filter_by(role='advisor').all()
        result = []
        for a in advisors:
            assigned_class = Class.query.filter_by(advisor_id=a.id).first()
            result.append({
                "id": a.id,
                "username": a.username,
                "fullname": a.fullname,
                "email": a.email,
                "class_id": assigned_class.id if assigned_class else None,
                "class_name": assigned_class.name if assigned_class else None
            })
        return jsonify(result)

    if request.method == 'POST':
        data = request.get_json() or {}
        if User.query.filter_by(username=data['username']).first():
            return jsonify({"msg": "Username already exists"}), 400
        if data.get('email') and User.query.filter_by(email=data.get('email')).first():
            return jsonify({"msg": "Email already exists"}), 400
            
        new_user = User(
            username=data['username'],
            password_hash=generate_password_hash(data.get('password', 'password123')),
            role='advisor',
            fullname=data['fullname'],
            email=data['email']
        )
        db.session.add(new_user)
        db.session.flush()

        class_id = data.get('class_id')
        class_name = data.get('class_name')
        cls, error = _ensure_class(class_id=class_id, class_name=class_name, advisor_id=new_user.id)
        if error:
            db.session.rollback()
            return jsonify({"msg": error}), 400

        db.session.commit()
        return jsonify({"msg": "Advisor created successfully"}), 201

@admin_bp.route('/advisors/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def update_delete_advisor(id):
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        return jsonify({"msg": "Admin access required"}), 403
    
    advisor = User.query.get_or_404(id)
    if advisor.role != 'advisor':
        return jsonify({"msg": "User is not an advisor"}), 400

    if request.method == 'DELETE':
        # Unlink from class if any
        linked_class = Class.query.filter_by(advisor_id=advisor.id).first()
        if linked_class:
            linked_class.advisor_id = None
        db.session.delete(advisor)
        db.session.commit()
        return jsonify({"msg": "Advisor deleted"})
    
    if request.method == 'PUT':
        data = request.get_json() or {}
        if data.get('email') and data.get('email') != advisor.email:
            if User.query.filter(User.email == data.get('email'), User.id != advisor.id).first():
                return jsonify({"msg": "Email already exists"}), 400

        advisor.fullname = data.get('fullname', advisor.fullname)
        advisor.email = data.get('email', advisor.email)
        if 'password' in data and data['password']:
            advisor.password_hash = generate_password_hash(data['password'])

        class_id = data.get('class_id') if 'class_id' in data else None
        class_name = data.get('class_name') if 'class_name' in data else None
        if 'class_id' in data or 'class_name' in data:
            existing_classes = Class.query.filter_by(advisor_id=advisor.id).all()
            for cls in existing_classes:
                cls.advisor_id = None
            cls, error = _ensure_class(class_id=class_id, class_name=class_name, advisor_id=advisor.id)
            if error:
                db.session.rollback()
                return jsonify({"msg": error}), 400
        db.session.commit()
        return jsonify({"msg": "Advisor updated"})


@admin_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'admin':
        return jsonify({"msg": "Admin access required"}), 403

    rows = _attendance_rows('weekly')
    total_rows = len(rows)
    present_rows = sum(1 for row in rows if row['status'] == 'present')
    verified_rows = sum(1 for row in rows if row['verified'])
    daily = []
    for session_date in _all_session_dates()[-7:]:
        day_rows = [row for row in rows if row['date'] == session_date.isoformat()]
        rate = round((sum(1 for row in day_rows if row['status'] == 'present') / len(day_rows)) * 100) if day_rows else 0
        daily.append(rate)

    return jsonify({
        "present_rate": round((present_rows / total_rows) * 100, 2) if total_rows else 0,
        "avg_verified": round((verified_rows / total_rows) * 100, 2) if total_rows else 0,
        "daily": daily or [0, 0, 0, 0, 0, 0, 0],
        "weekly_trend": "up" if len(daily) >= 2 and daily[-1] >= daily[0] else "down",
        "new_students": User.query.filter_by(role='student').count()
    })

@admin_bp.route('/attendance/history', methods=['GET'])
@jwt_required()
def get_attendance_history():
    filter_type = request.args.get('filter', 'all') # all, daily, weekly, monthly
    export_format = request.args.get('export') # xlsx, pdf
    
    data = _attendance_rows(filter_type=filter_type)
    summary = _attendance_summary(data)

    if export_format == 'xlsx':
        export_rows = _export_table_rows(data)
        df = pd.DataFrame(export_rows)
        summary_df = pd.DataFrame([{
            "S.No": "",
            "Student Name": "TOTAL",
            "Roll No": "",
            "Class": "",
            "Advisor": "",
            "Date": "",
            "Time": "",
            "Status": f"Present: {summary['present']} | Absent: {summary['absent']}",
            "Verified": f"Verified: {summary['verified']}",
        }])
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Attendance')
            summary_df.to_excel(writer, index=False, sheet_name='Summary')
        output.seek(0)
        return send_file(output, download_name=f"Admin_Report_{filter_type}.xlsx", as_attachment=True)
    
    elif export_format == 'pdf':
        output = _build_pdf_report(data, filter_type)
        return send_file(output, download_name=f"Admin_Report_{filter_type}.pdf", as_attachment=True, mimetype='application/pdf')

    return jsonify({
        "rows": data,
        "summary": summary
    })

# Consolidating stats route (already defined at top)
