import os

import io
from datetime import timedelta
from urllib.parse import urlsplit, urlunsplit

from flask import Flask, send_from_directory, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.security import generate_password_hash
from routes.auth import auth_bp
from routes.attendance import attendance_bp
from routes.advisor import advisor_bp
from routes.admin import admin_bp
from models import db, User, Class, Student

app = Flask(__name__)

# Database setup:
# - If DATABASE_URL is provided (recommended for Render), use it (Postgres, etc.)
# - Otherwise fall back to local SQLite (dev only)
default_sqlite = f"sqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'attendance.db')}"
db_uri = os.environ.get("DATABASE_URL") or default_sqlite

# SQLAlchemy prefers postgresql:// (some providers still output postgres://)
if db_uri.startswith("postgres://"):
    db_uri = "postgresql://" + db_uri[len("postgres://"):]

app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# SECURITY: override in Render env vars.
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY') or 'dev-insecure-jwt-secret-change-me'
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB Max upload
# SECURITY: tokens should expire (default 7 days).
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=int(os.environ.get("JWT_DAYS", "7")))

# Pre-Flight Diagnostic Log
print("==========================================")
print("SmartAttend System Pre-Flight Check")
print(f"Upload Path: {app.config['UPLOAD_FOLDER']}")
print("Bio-Stack: MediaPipe + InsightFace(ArcFace)")
print("Security: JWT-HMAC-SHA256 (32B Mode)")
print("==========================================")

def _mask_db_url(url: str) -> str:
    """
    Mask password in a DB URL for safe logging.
    Example: postgresql://user:pass@host/db -> postgresql://user:***@host/db
    """
    try:
        parts = urlsplit(url)
        if not parts.username or parts.password is None:
            return url
        netloc = parts.netloc.replace(f":{parts.password}@", ":***@")
        return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    except Exception:
        return "<unparseable-db-url>"

_using_external_db = bool(os.environ.get("DATABASE_URL"))
print(f"DB Config: using_external_db={_using_external_db} uri={_mask_db_url(db_uri)}")

os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'students'), exist_ok=True)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/public/student-photo/<int:student_id>')
def public_student_photo(student_id):
    """
    Public photo URL for mobile/webview stability.
    This serves the cropped face stored in DB (preferred) or falls back to local file.
    """
    student = Student.query.get(int(student_id))
    if not student:
        return {"msg": "Not found"}, 404

    if getattr(student, "reference_image_blob", None):
        mime = getattr(student, "reference_image_mime", None) or "image/jpeg"
        return send_file(io.BytesIO(student.reference_image_blob), mimetype=mime)

    if student.reference_image_path:
        return send_from_directory(app.config['UPLOAD_FOLDER'], student.reference_image_path)

    return {"msg": "No photo"}, 404

# CORS: allow all by default (mobile webviews can have "null" origins).
# For strict allowlist: set CORS_ORIGINS="https://smart-attend-three.vercel.app"
origins_env = (os.environ.get("CORS_ORIGINS") or "").strip()
origins = [o.strip() for o in origins_env.split(",") if o.strip()] if origins_env else "*"
CORS(app, resources={r"/*": {"origins": origins}})
db.init_app(app)
jwt = JWTManager(app)

app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(attendance_bp, url_prefix='/attendance')
app.register_blueprint(advisor_bp, url_prefix='/advisor')
app.register_blueprint(admin_bp, url_prefix='/admin')

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database')
os.makedirs(db_path, exist_ok=True)

with app.app_context():
    db.create_all()

    # Lightweight migrations (no alembic). Ensures new columns exist across SQLite/Postgres.
    try:
        dialect = db.engine.dialect.name

        if dialect == "sqlite":
            import sqlite3

            db_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'attendance.db')
            con = sqlite3.connect(db_file)
            cur = con.cursor()

            cols = [row[1] for row in cur.execute("PRAGMA table_info(face_embeddings)").fetchall()]
            if "engine" not in cols:
                cur.execute("ALTER TABLE face_embeddings ADD COLUMN engine VARCHAR(20)")

            scol = [row[1] for row in cur.execute("PRAGMA table_info(students)").fetchall()]
            if "reference_image_blob" not in scol:
                cur.execute("ALTER TABLE students ADD COLUMN reference_image_blob BLOB")
            if "reference_image_mime" not in scol:
                cur.execute("ALTER TABLE students ADD COLUMN reference_image_mime VARCHAR(50)")

            con.commit()
            con.close()

        elif dialect in ("postgresql", "postgres"):
            # Postgres supports IF NOT EXISTS; safe to run every boot.
            from sqlalchemy import text

            db.session.execute(text("ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS engine VARCHAR(20)"))
            db.session.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS reference_image_blob BYTEA"))
            db.session.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS reference_image_mime VARCHAR(50)"))
            db.session.commit()
    except Exception as mig_err:
        print(f"DB migration warning: {mig_err}")

    def seed_defaults():
        defaults = [
            ('admin', 'Admin@123', 'admin', 'System Admin', 'admin@smartattend.local'),
            ('advisor', 'Advisor@123', 'advisor', 'Class Advisor', 'advisor@smartattend.local'),
            ('student', 'Student@123', 'student', 'Student User', 'student@smartattend.local'),
            ('dhanush', 'Dhanush@123', 'student', 'Dhanush S', 'dhanush@smartattend.local'),
            ('Chiranjeevi', 'Chiru@123', 'student', 'Chiranjeevi', 'chiranjeevi@smartattend.local'),
        ]

        users = {}
        for username, password, role, fullname, email in defaults:
            user = User.query.filter_by(username=username).first()
            if not user:
                # Create only if missing. Do NOT overwrite passwords on every restart.
                user = User(
                    username=username,
                    password_hash=generate_password_hash(password),
                    role=role,
                    fullname=fullname,
                    email=email
                )
                db.session.add(user)
            else:
                # Fill in any missing fields, but never clobber password changes.
                user.role = user.role or role
                user.fullname = user.fullname or fullname
                user.email = user.email or email
            users[username] = user

        db.session.flush()

        default_class = Class.query.filter_by(name='CSE-A').first()
        if not default_class:
            default_class = Class(name='CSE-A', advisor_id=users['advisor'].id)
            db.session.add(default_class)
            db.session.flush()
        elif default_class.advisor_id is None:
            # Avoid overwriting admin allocation changes.
            default_class.advisor_id = users['advisor'].id

        student_defaults = [
            (users['student'], '2024ST001'),
            (users['dhanush'], '323UIT005'),
            (users['Chiranjeevi'], '004'),
        ]
        for user, roll_no in student_defaults:
            student = Student.query.filter_by(user_id=user.id).first()
            if not student:
                student = Student(user_id=user.id)
                db.session.add(student)
            # Only set defaults when missing; do not overwrite admin updates.
            student.class_id = student.class_id or default_class.id
            student.roll_no = student.roll_no or roll_no

        db.session.commit()

    seed_defaults()

@app.route('/')
def index():
    return {"message": "SmartAttend AI API is running"}


@app.route('/healthz')
def healthz():
    # Helps confirm whether the service is running on an external persistent DB.
    using_external = bool(os.environ.get("DATABASE_URL"))
    dialect = None
    try:
        dialect = db.engine.dialect.name
    except Exception:
        dialect = None

    return {
        "status": "ok",
        "db": {
            "dialect": dialect,
            "using_external_db": using_external,
            # NOTE: Render free's filesystem is ephemeral across deploys.
            # Persistence requires DATABASE_URL to an external DB (Postgres).
            "persistent": using_external and (dialect in ("postgresql", "postgres")),
        },
        "face_engine": os.environ.get("FACE_ENGINE") or "opencv",
    }, 200

# GLOBAL ERROR HANDLER
@app.errorhandler(Exception)
def handle_error(e):
    return {"msg": f"Backend Error: {str(e)}"}, 500

if __name__ == '__main__':
    import logging

    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    port = int(os.environ.get('PORT', 5000))

    print("==========================================")
    print("SmartAttend AI Backend is LIVE")
    print(f"Port: {port} | Mode: High Stability")
    print("==========================================")

    # No heavy AI warm-up: we use OpenCV ONNX models that load on-demand.

    app.run(debug=False, port=port, threaded=True, host='0.0.0.0')
