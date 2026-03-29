from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
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


@auth_bp.route('/profile', methods=['GET', 'PUT'])
@jwt_required()
def profile():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"message": "User not found"}), 404

    if request.method == 'GET':
        return jsonify({
            "id": user.id,
            "username": user.username,
            "fullname": user.fullname,
            "email": user.email,
            "role": user.role
        }), 200

    data = request.get_json() or {}

    new_fullname = (data.get('fullname') or user.fullname or '').strip()
    new_email = (data.get('email') or user.email or '').strip() or None
    new_password = (data.get('password') or '').strip()

    if new_email and new_email != user.email:
        existing = User.query.filter(User.email == new_email, User.id != user.id).first()
        if existing:
            return jsonify({"message": "Email already exists"}), 400

    user.fullname = new_fullname
    user.email = new_email
    if new_password:
        user.password_hash = generate_password_hash(new_password)

    db.session.commit()
    return jsonify({
        "message": "Profile updated successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "fullname": user.fullname,
            "email": user.email,
            "role": user.role
        }
    }), 200
