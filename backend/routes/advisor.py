from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Student, User, Class, Attendance, Notification
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import io
import pandas as pd
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph

advisor_bp = Blueprint('advisor', __name__)
API_BASE_URL = "http://127.0.0.1:5000"


def _class_session_dates(class_id):
    rows = db.session.query(Attendance.date).join(Student).filter(
        Student.class_id == class_id
    ).distinct().all()
    return sorted({row[0] for row in rows if row[0]})


def _student_attendance_metrics(student):
    session_dates = _class_session_dates(student.class_id) if student.class_id else []
    present_rows = db.session.query(Attendance.date).filter_by(
        student_id=student.id,
        status='present'
    ).distinct().all()
    present = len({row[0] for row in present_rows if row[0]})
    absent = max(len(session_dates) - present, 0)
    attendance_pct = round((present / len(session_dates)) * 100) if session_dates else 0
    return present, absent, attendance_pct


def _advisor_export_pdf(data, class_name):
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=20, rightMargin=20, topMargin=20, bottomMargin=20)
    styles = getSampleStyleSheet()
    total = len(data)
    present = sum(1 for row in data if row["Status"] == "Present")
    absent = sum(1 for row in data if row["Status"] == "Absent")

    elements = [
        Paragraph(f"Class Attendance Report - {class_name}", styles["Title"]),
        Spacer(1, 8),
        Paragraph(f"Total Rows: {total} | Present: {present} | Absent: {absent}", styles["Heading3"]),
        Spacer(1, 12),
    ]

    table_data = [["S.No", "Student Name", "Roll No", "Date", "Time", "Status"]]
    for index, row in enumerate(data, start=1):
        table_data.append([
            index,
            row["Student"],
            row["Roll No"],
            row["Date"],
            row["Time"],
            row["Status"],
        ])

    table = Table(table_data, repeatRows=1, colWidths=[40, 150, 80, 100, 70, 80])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]))
    elements.append(table)
    doc.build(elements)
    output.seek(0)
    return output


def _advisor_attendance_rows(cls, filter_type="all"):
    now = datetime.utcnow().date()
    session_dates = _class_session_dates(cls.id)

    if filter_type == 'daily':
        session_dates = [d for d in session_dates if d == now]
    elif filter_type == 'weekly':
        one_week_ago = now - timedelta(days=7)
        session_dates = [d for d in session_dates if d >= one_week_ago]
    elif filter_type == 'monthly':
        one_month_ago = now - timedelta(days=30)
        session_dates = [d for d in session_dates if d >= one_month_ago]

    students = Student.query.filter_by(class_id=cls.id).all()
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
                "date": session_date.isoformat(),
                "time": record.time.strftime("%H:%M:%S") if record and record.time else "-",
                "status": record.status if record else "absent",
                "verified": bool(record.verified) if record else False,
                "location": f"{record.gps_lat}, {record.gps_long}" if record and record.gps_lat is not None and record.gps_long is not None else "N/A"
            })
    return rows


def _advisor_summary(rows):
    return {
        "total": len(rows),
        "present": sum(1 for row in rows if row["status"] == "present"),
        "absent": sum(1 for row in rows if row["status"] == "absent"),
        "verified": sum(1 for row in rows if row["verified"]),
    }

@advisor_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def get_advisor_stats():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'advisor':
        return jsonify({"msg": "Advisor access required"}), 403
    
    cls = Class.query.filter_by(advisor_id=user.id).first()
    if not cls:
        return jsonify({"msg": "No class assigned to this advisor"}), 404
    
    students = Student.query.filter_by(class_id=cls.id).all()
    total_students = len(students)
    today = datetime.utcnow().date()
    today_present = db.session.query(Attendance.student_id).join(Student).filter(
        Student.class_id == cls.id,
        Attendance.date == today,
        Attendance.status == 'present'
    ).distinct().count()
    today_absent = max(total_students - today_present, 0)

    critical_alerts = 0
    for s in students:
        _, _, attendance_pct = _student_attendance_metrics(s)
        if attendance_pct < 75:
            critical_alerts += 1
    
    return jsonify({
        "class_name": cls.name,
        "total_students": total_students,
        "critical_alerts": critical_alerts,
        "today_present": today_present,
        "today_absent": today_absent
    })

@advisor_bp.route('/students', methods=['GET', 'POST'])
@jwt_required()
def manage_students():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'advisor':
        return jsonify({"msg": "Advisor access required"}), 403
    
    cls = Class.query.filter_by(advisor_id=user.id).first()
    if not cls:
        return jsonify({"msg": "No class assigned"}), 404

    if request.method == 'GET':
        students = Student.query.filter_by(class_id=cls.id).all()
        result = []
        for s in students:
            _, absent, attendance_pct = _student_attendance_metrics(s)
            
            # Today's status
            today = datetime.utcnow().date()
            att_today = Attendance.query.filter_by(student_id=s.id, date=today).first()
            
            image_url = f"{API_BASE_URL}/uploads/{s.reference_image_path}" if s.reference_image_path else None

            result.append({
                "id": s.id,
                "fullname": s.user.fullname,
                "roll_no": s.roll_no,
                "username": s.user.username,
                "email": s.user.email,
                "attendance": f"{round(attendance_pct)}%",
                "status": att_today.status.capitalize() if att_today else "Absent",
                "absent": absent,
                "image": image_url
            })
        return jsonify(result)

    if request.method == 'POST':
        data = request.form
        file = request.files.get('image')

        # Check if username exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({"msg": "Username already exists"}), 400

        new_user = User(
            username=data['username'],
            password_hash=generate_password_hash(data.get('password', 'password123')),
            role='student',
            fullname=data['fullname'],
            email=data['email']
        )
        db.session.add(new_user)
        db.session.commit()
        
        filename = None
        if file:
            filename = f"students/{new_user.id}_{file.filename}"
            from flask import current_app
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)

        new_student = Student(
            user_id=new_user.id,
            roll_no=data['roll_no'],
            class_id=cls.id,
            reference_image_path=filename
        )
        db.session.add(new_student)
        db.session.commit()
        return jsonify({"msg": "Student added to class"}), 201

@advisor_bp.route('/students/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
def update_delete_student(id):
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user.role != 'advisor':
        return jsonify({"msg": "Advisor access required"}), 403
    
    student = Student.query.get_or_404(id)
    if request.method == 'DELETE':
        user_to_del = User.query.get(student.user_id)
        db.session.delete(student)
        db.session.delete(user_to_del)
        db.session.commit()
        return jsonify({"msg": "Student removed"})
    
    if request.method == 'PUT':
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            data = request.form
        else:
            data = request.get_json() or {}
        student.user.fullname = data.get('fullname', student.user.fullname)
        student.user.email = data.get('email', student.user.email)
        student.roll_no = data.get('roll_no', student.roll_no)
        db.session.commit()
        return jsonify({"msg": "Student data updated"})

@advisor_bp.route('/announcements', methods=['POST'])
@jwt_required()
def send_announcement():
    user_id = get_jwt_identity()
    data = request.json
    cls = Class.query.filter_by(advisor_id=int(user_id)).first()
    if not cls:
        return jsonify({"msg": "No class assigned"}), 404
    
    # Send to all students in the class
    students = Student.query.filter_by(class_id=cls.id).all()
    for s in students:
        notif = Notification(
            user_id=s.user_id,
            message=data['message'],
            type='alert' if data.get('urgent') else 'info'
        )
        db.session.add(notif)
    db.session.commit()
    return jsonify({"msg": "Announcement sent"}), 200

@advisor_bp.route('/reports/export', methods=['GET'])
@jwt_required()
def export_report():
    user_id = get_jwt_identity()
    cls = Class.query.filter_by(advisor_id=int(user_id)).first()
    if not cls:
        return jsonify({"msg": "No class assigned"}), 404
    filter_type = request.args.get('filter', 'all')
    export_format = request.args.get('export', 'pdf')
    rows = _advisor_attendance_rows(cls, filter_type=filter_type)
    data = [{
        "Student": row["student_name"],
        "Roll No": row["roll_no"],
        "Date": row["date"],
        "Time": row["time"],
        "Status": row["status"].capitalize()
    } for row in rows]
    
    df = pd.DataFrame(data)
    if export_format == 'xlsx':
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Attendance')
        output.seek(0)
        return send_file(output, download_name=f"Class_Report_{cls.name}.xlsx", as_attachment=True)

    output = _advisor_export_pdf(data, cls.name)
    return send_file(output, download_name=f"Class_Report_{cls.name}.pdf", as_attachment=True, mimetype='application/pdf')


@advisor_bp.route('/reports/history', methods=['GET'])
@jwt_required()
def advisor_report_history():
    user_id = get_jwt_identity()
    cls = Class.query.filter_by(advisor_id=int(user_id)).first()
    if not cls:
        return jsonify({"msg": "No class assigned"}), 404

    filter_type = request.args.get('filter', 'all')
    rows = _advisor_attendance_rows(cls, filter_type=filter_type)
    return jsonify({
        "rows": rows,
        "summary": _advisor_summary(rows),
        "class_name": cls.name
    })


@advisor_bp.route('/analytics', methods=['GET'])
@jwt_required()
def advisor_analytics():
    user_id = get_jwt_identity()
    cls = Class.query.filter_by(advisor_id=int(user_id)).first()
    if not cls:
        return jsonify({"msg": "No class assigned"}), 404

    students = Student.query.filter_by(class_id=cls.id).all()
    session_dates = _class_session_dates(cls.id)
    total_slots = len(students) * len(session_dates)
    present_total = sum(_student_attendance_metrics(student)[0] for student in students)

    top_name = "N/A"
    top_pct = 0
    for student in students:
        _, _, pct = _student_attendance_metrics(student)
        if pct >= top_pct:
            top_pct = pct
            top_name = student.user.fullname

    distribution = []
    recent_dates = session_dates[-5:]
    for session_date in recent_dates:
        day_rows = Attendance.query.join(Student).filter(
            Student.class_id == cls.id,
            Attendance.date == session_date,
            Attendance.status == 'present'
        ).distinct(Attendance.student_id).count()
        day_pct = round((day_rows / len(students)) * 100) if students else 0
        distribution.append({
            "label": session_date.strftime('%a'),
            "val": day_pct
        })

    month_map = {}
    for session_date in session_dates:
        month_key = session_date.strftime('%B %Y')
        month_map.setdefault(month_key, {"dates": [], "present_total": 0})
        month_map[month_key]["dates"].append(session_date)

    month_reports = []
    for month_name, info in month_map.items():
        month_dates = info["dates"]
        total_slots_month = len(students) * len(month_dates)
        present_month = Attendance.query.join(Student).filter(
            Student.class_id == cls.id,
            Attendance.date.in_(month_dates),
            Attendance.status == 'present'
        ).distinct(Attendance.student_id, Attendance.date).count()
        month_reports.append({
            "month": month_name,
            "sessions": len(month_dates),
            "present_rate": round((present_month / total_slots_month) * 100, 2) if total_slots_month else 0
        })

    student_matrix = []
    for student in students:
        present, absent, pct = _student_attendance_metrics(student)
        student_matrix.append({
            "student_name": student.user.fullname,
            "roll_no": student.roll_no,
            "present": present,
            "absent": absent,
            "attendance_pct": pct
        })
    student_matrix.sort(key=lambda item: (-item["attendance_pct"], item["student_name"]))

    return jsonify({
        "monthly_avg": round((present_total / total_slots) * 100, 2) if total_slots else 0,
        "weekly_change": f"+{distribution[-1]['val'] - distribution[0]['val']}%" if len(distribution) >= 2 else "+0%",
        "distribution": distribution or [
            {"label": "Mon", "val": 0},
            {"label": "Tue", "val": 0},
            {"label": "Wed", "val": 0},
            {"label": "Thu", "val": 0},
            {"label": "Fri", "val": 0},
        ],
        "top_performer": top_name,
        "top_pct": top_pct,
        "month_reports": month_reports[-6:],
        "student_matrix": student_matrix[:10]
    })
