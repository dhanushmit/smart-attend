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
        if User.query.filter_by(role='admin').first():
            return

        admin = User(
            username='admin',
            password_hash=generate_password_hash('Admin@123'),
            role='admin',
            fullname='System Admin',
            email='admin@smartattend.local'
        )
        advisor = User(
            username='advisor',
            password_hash=generate_password_hash('Advisor@123'),
            role='advisor',
            fullname='Class Advisor',
            email='advisor@smartattend.local'
        )
        student = User(
            username='student',
            password_hash=generate_password_hash('Student@123'),
            role='student',
            fullname='Student User',
            email='student@smartattend.local'
        )
        dhanush = User(
            username='dhanush',
            password_hash=generate_password_hash('Dhanush@123'),
            role='student',
            fullname='Dhanush S',
            email='dhanush@smartattend.local'
        )
        chiru = User(
            username='Chiranjeevi',
            password_hash=generate_password_hash('Chiru@123'),
            role='student',
            fullname='Chiranjeevi',
            email='chiranjeevi@smartattend.local'
        )

        db.session.add_all([admin, advisor, student, dhanush, chiru])
        db.session.flush()

        default_class = Class(name='CSE-A', advisor_id=advisor.id)
        db.session.add(default_class)
        db.session.flush()

        db.session.add_all([
            Student(user_id=student.id, class_id=default_class.id, roll_no='2024ST001'),
            Student(user_id=dhanush.id, class_id=default_class.id, roll_no='323UIT005'),
            Student(user_id=chiru.id, class_id=default_class.id, roll_no='004'),
        ])
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
