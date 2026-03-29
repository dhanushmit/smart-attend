import os

# CRITICAL FIX for DeepFace + TensorFlow 2.16+ Keras error
os.environ['TF_USE_LEGACY_KERAS'] = '1'

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.security import generate_password_hash
from routes.auth import auth_bp
from routes.attendance import attendance_bp
from routes.advisor import advisor_bp
from routes.admin import admin_bp
from models import db, User, Class, Student

app = Flask(__name__)

# Strictly Local SQLite Database Setup
db_uri = f"sqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'attendance.db')}"

app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'smar-attend-secure-system-key-2024-v2'
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB Max upload
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = False

# Pre-Flight Diagnostic Log
print("==========================================")
print("SmartAttend System Pre-Flight Check")
print(f"Upload Path: {app.config['UPLOAD_FOLDER']}")
print("Bio-Stack: MediaPipe + InsightFace(ArcFace)")
print("Security: JWT-HMAC-SHA256 (32B Mode)")
print("==========================================")

os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'students'), exist_ok=True)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

CORS(app)
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
                user = User(username=username)
                db.session.add(user)
            user.password_hash = generate_password_hash(password)
            user.role = role
            user.fullname = fullname
            user.email = email
            users[username] = user

        db.session.flush()

        default_class = Class.query.filter_by(name='CSE-A').first()
        if not default_class:
            default_class = Class(name='CSE-A')
            db.session.add(default_class)
            db.session.flush()
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
            student.class_id = default_class.id
            student.roll_no = roll_no

        db.session.commit()

    seed_defaults()

@app.route('/')
def index():
    return {"message": "SmartAttend AI API is running"}


@app.route('/healthz')
def healthz():
    return {"status": "ok"}, 200

# GLOBAL ERROR HANDLER
@app.errorhandler(Exception)
def handle_error(e):
    return {"msg": f"Backend Error: {str(e)}"}, 500

if __name__ == '__main__':
    import logging

    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    # Optional: Prevent TensorFlow from taking all RAM at once
    try:
        import tensorflow as tf
        gpus = tf.config.experimental.list_physical_devices('GPU')
        if gpus:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
    except Exception:
        pass

    port = int(os.environ.get('PORT', 5000))

    print("==========================================")
    print("SmartAttend AI Backend is LIVE")
    print(f"Port: {port} | Mode: High Stability")
    print("==========================================")

    # Proactive AI Model Pre-loader
    def preload_models():
        try:
            from deepface import DeepFace
            import numpy as np

            print("Checking AI Models (ArcFace + MediaPipe)...")
            print("Do not close this window during first-time download.")

            dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
            DeepFace.represent(
                img_path=dummy_img,
                model_name="ArcFace",
                detector_backend="retinaface",
                enforce_detection=False
            )
            print("AI Models (RetinaFace + ArcFace) Ready!")
        except Exception as e:
            print(f"AI Cache Note: {e}")

    # Render free instances are memory-constrained, so skip heavy model warm-up there.
    if not os.environ.get('RENDER'):
        import threading
        threading.Thread(target=preload_models, daemon=True).start()
    else:
        print("Skipping AI warm-up on Render to reduce startup memory usage.")

    app.run(debug=False, port=port, threaded=True, host='0.0.0.0')
