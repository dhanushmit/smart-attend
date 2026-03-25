from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, index=True) # 'admin', 'advisor', 'student'
    fullname = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Class(db.Model):
    __tablename__ = 'classes'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False, index=True)
    advisor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), index=True)
    advisor = db.relationship('User', backref='classes_managed')

class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), index=True)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id', ondelete='SET NULL'), index=True)
    roll_no = db.Column(db.String(20), unique=True, index=True)
    reference_image_path = db.Column(db.Text) # Representative image
    
    user = db.relationship('User', backref='student_profile')
    student_class = db.relationship('Class', backref='students')
    # Multi-embedding relationship (Scalable Method)
    embeddings = db.relationship('FaceEmbedding', backref='student', cascade="all, delete-orphan")

class FaceEmbedding(db.Model):
    __tablename__ = 'face_embeddings'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id', ondelete='CASCADE'), nullable=False, index=True)
    # Native SQLite support uses JSON strings
    embedding = db.Column(db.Text, nullable=False) 
    label = db.Column(db.String(50)) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

class Attendance(db.Model):
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id', ondelete='CASCADE'), index=True)
    date = db.Column(db.Date, default=datetime.utcnow().date, index=True)
    time = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    status = db.Column(db.String(10), index=True) # 'present', 'absent', 'late'
    gps_lat = db.Column(db.Float)
    gps_long = db.Column(db.Float)
    verified = db.Column(db.Boolean, default=False)
    
    student = db.relationship('Student', backref='attendance_records')

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), index=True)
    message = db.Column(db.Text)
    type = db.Column(db.String(20)) # 'alert', 'info', 'warning'
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
