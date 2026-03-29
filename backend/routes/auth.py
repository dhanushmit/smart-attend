from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User

auth_bp = Blueprint('auth', __name__)


def _upload_url(filename):
    if not filename:
        return None
    return f"{request.host_url.rstrip('/')}/uploads/{filename}"

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'student') # Default to student
    fullname = data.get('fullname')
    email = data.get('email')
    
    if User.query.filter_by(username=username).first():
        return jsonify({"message": "User already exists"}), 400
        
    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password_hash=hashed_password, role=role, fullname=fullname, email=email)
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({"message": "User created successfully"}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        user = User.query.filter_by(username=data.get('username')).first()
        
        if user and check_password_hash(user.password_hash, data.get('password')):
            img = None
            if user.role == 'student' and user.student_profile and len(user.student_profile) > 0:
                s = user.student_profile[0]
                if s.reference_image_path:
                    img = _upload_url(s.reference_image_path)
            
            access_token = create_access_token(identity=str(user.id))
            return jsonify({
                "access_token": access_token, 
                "role": user.role, 
                "fullname": user.fullname, 
                "id": user.id,
                "image": img
            }), 200
            
        return jsonify({"message": "Invalid credentials"}), 401
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500
