from flask import Blueprint, flash, jsonify, redirect, request, current_app, send_from_directory, session, url_for
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User
import re
import logging
from datetime import datetime
from functools import wraps
import os
import uuid
from werkzeug.utils import secure_filename
from PIL import Image
# Setup logging
logger = logging.getLogger("auth")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

auth_bp = Blueprint('auth', __name__)


# Add these constants after your imports
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def resize_and_save_avatar(file, user_id):
    """Resize image and save as avatar"""
    try:
        # Generate unique filename
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"avatar_{user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
        
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join(current_app.static_folder, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save and resize image
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Open and resize image
        image = Image.open(file)
        
        # Convert to RGB if necessary (for PNG with transparency)
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        
        # Resize to 400x400
        image = image.resize((400, 400), Image.Resampling.LANCZOS)
        
        # Save with high quality
        image.save(file_path, format='JPEG', quality=95, optimize=True)
        
        return unique_filename
        
    except Exception as e:
        logger.error(f"Error processing avatar: {str(e)}")
        return None

# Add these routes to your auth.py

@auth_bp.route('/api/auth/upload-avatar', methods=['POST'])
@login_required
def upload_avatar():
    """Upload user avatar"""
    try:
        if 'avatar' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No file provided'
            }), 400
        
        file = request.files['avatar']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'message': 'Invalid file type. Please upload PNG, JPG, JPEG, GIF, or WEBP files.'
            }), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({
                'success': False,
                'message': 'File too large. Maximum size is 5MB.'
            }), 400
        
        # Delete old avatar if it's not the default
        if current_user.profile_image and current_user.profile_image != 'default.png':
            old_avatar_path = os.path.join(current_app.static_folder, 'uploads', current_user.profile_image)
            if os.path.exists(old_avatar_path):
                try:
                    os.remove(old_avatar_path)
                except Exception as e:
                    logger.warning(f"Failed to delete old avatar: {str(e)}")
        
        # Save new avatar
        filename = resize_and_save_avatar(file, current_user.id)
        
        if not filename:
            return jsonify({
                'success': False,
                'message': 'Failed to process image'
            }), 500
        
        # Update user profile
        current_user.profile_image = filename
        current_user.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Avatar updated for user: {current_user.username}")
        
        return jsonify({
            'success': True,
            'message': 'Avatar updated successfully',
            'user': current_user.to_dict()  # Use the new to_dict method
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Avatar upload error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to upload avatar'
        }), 500
    
@auth_bp.route('/api/auth/delete-avatar', methods=['DELETE'])
@login_required
def delete_avatar():
    """Delete user profile picture"""
    
    try:
        # Check if user has a custom avatar
        if not current_user.profile_image or current_user.profile_image == 'default.png':
            return jsonify({'error': 'No custom avatar to delete'}), 400
        
        # Delete file
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], current_user.profile_image)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            logger.warning(f"Failed to delete avatar file: {str(e)}")
        
        # Reset to default
        current_user.profile_image = 'default.png'
        current_user.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Avatar deleted for user: {current_user.username}")
        
        return jsonify({
            'success': True,
            'message': 'Profile picture deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Avatar deletion error: {str(e)}")
        return jsonify({'error': 'Failed to delete profile picture'}), 500

# -------------------------------
# Validation Helpers
# -------------------------------

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_username(username):
    """Validate username format (GitHub-like)"""
    pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$'
    return re.match(pattern, username) is not None

def validate_password(password):
    """Basic password validation"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Za-z]', password):
        return False, "Password must contain at least one letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, "Valid password"

# -------------------------------
# Rate Limiting (Simple In-Memory)
# -------------------------------

from collections import defaultdict
import time

rate_limit_storage = defaultdict(list)

def is_rate_limited(identifier, max_attempts=5, window_minutes=15):
    """Simple rate limiting"""
    now = time.time()
    window_seconds = window_minutes * 60

    # Clean old attempts
    rate_limit_storage[identifier] = [
        timestamp for timestamp in rate_limit_storage[identifier]
        if now - timestamp < window_seconds
    ]

    # Check if over limit
    if len(rate_limit_storage[identifier]) >= max_attempts:
        return True

    # Add current attempt
    rate_limit_storage[identifier].append(now)
    return False

# -------------------------------
# API Routes
# -------------------------------

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration API"""
    session.clear()
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        
        # Validation
        if not all([username, email, password, confirm_password]):
            return jsonify({    
                'success': False,
                'message': 'All fields are required'
            }), 400
        
        if password != confirm_password:
            return jsonify({
                'success': False,
                'message': 'Passwords do not match'
            }), 400
        
        if len(password) < 6:
            return jsonify({
                'success': False,
                'message': 'Password must be at least 6 characters long'
            }), 400
        
        if len(username) < 3:
            return jsonify({
                'success': False,
                'message': 'Username must be at least 3 characters long'
            }), 400
        
        # Email validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({
                'success': False,
                'message': 'Invalid email format'
            }), 400
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({
                'success': False,
                'message': 'Username already exists'
            }), 409
        
        if User.query.filter_by(email=email).first():
            return jsonify({
                'success': False,
                'message': 'Email already registered'
            }), 409
        
        # Create new user with default profile image
        user = User(
            username=username,
            email=email,
            profile_image='default.png'
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # AUTO-LOGIN THE USER AFTER REGISTRATION
        login_user(user, remember=False)
        
        logger.info(f"New user registered and logged in: {username}")
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'redirect': '/dashboard',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Registration error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Registration failed. Please try again.'
        }), 500

@auth_bp.route('/login', methods=['GET'])
def login_page():
    """Serve login page (React app)"""
    if current_user.is_authenticated:
        return redirect('/dashboard')
    return send_from_directory('dist', 'index.html')

@auth_bp.route('/register', methods=['GET'])
def register_page():
    """Serve register page (React app)"""
    if current_user.is_authenticated:
        return redirect('/dashboard')
    return send_from_directory('dist', 'index.html')

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login API"""
    session.clear()
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        username_or_email = data.get('username', '').strip()
        password = data.get('password', '')
        remember = data.get('remember', False)

        if not username_or_email or not password:
            return jsonify({'error': 'Username/email and password are required'}), 400

        # Check rate limiting
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
        if is_rate_limited(f"login_{client_ip}", max_attempts=10, window_minutes=15):
            logger.warning(f"Login rate limit exceeded for IP: {client_ip}")
            return jsonify({'error': 'Too many login attempts. Please try again later.'}), 429

        # Find user by username or email
        user = None
        if '@' in username_or_email:
            user = User.query.filter_by(email=username_or_email.lower()).first()
        else:
            user = User.query.filter_by(username=username_or_email).first()

        # Validate credentials
        if not user or not user.check_password(password):
            logger.warning(f"Failed login attempt for: {username_or_email}")
            return jsonify({'error': 'Invalid username/email or password'}), 401

        # Login user
        login_user(user, remember=remember)

        # Update last login
        user.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"User logged in: {user.username}")

        # Fix: avatar_url may be a method, so call it if needed
        avatar_url = user.avatar_url
        if callable(avatar_url):
            avatar_url = avatar_url()

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'avatar_url': avatar_url
            },
            'redirect': '/dashboard'
        })

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500

@auth_bp.route('/logout', methods=['GET', 'POST'])
def logout():
    if current_user.is_authenticated:
        logout_user()
        session.clear()
        flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login_page'))  # Changed to login_page

@auth_bp.route('/api/auth/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current user information"""
    try:
        return jsonify({
            'success': True,
            'user': current_user.to_dict()  # Use the new to_dict method
        }), 200
    except Exception as e:
        logger.error(f"Error fetching current user: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch user information'
        }), 500

@auth_bp.route('/api/auth/update-profile', methods=['PUT'])
@login_required
def update_profile():
    """Update user profile"""

    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        allowed_fields = ['full_name', 'bio', 'location', 'website']
        updated_fields = []

        for field in allowed_fields:
            if field in data:
                value = data[field].strip() if data[field] else None

                # Validate website URL
                if field == 'website' and value:
                    if not value.startswith(('http://', 'https://')):
                        value = 'https://' + value
                    if not re.match(r'https?://[^\s]+', value):
                        return jsonify({'error': 'Invalid website URL'}), 400

                setattr(current_user, field, value)
                updated_fields.append(field)

        if updated_fields:
            current_user.updated_at = datetime.utcnow()
            db.session.commit()

            logger.info(f"Profile updated for user {current_user.username}: {updated_fields}")

            return jsonify({
                'success': True,
                'message': 'Profile updated successfully',
                'updated_fields': updated_fields
            })
        else:
            return jsonify({'error': 'No valid fields to update'}), 400

    except Exception as e:
        db.session.rollback()
        logger.error(f"Profile update error: {str(e)}")
        return jsonify({'error': 'Profile update failed'}), 500

@auth_bp.route('/api/auth/change-password', methods=['PUT'])
@login_required
def change_password():
    """Change user password"""

    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')

        if not current_password or not new_password:
            return jsonify({'error': 'Current and new passwords are required'}), 400

        # Verify current password
        if not current_user.check_password(current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401

        # Validate new password
        is_valid, msg = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': msg}), 400

        # Check if new password is different
        if current_user.check_password(new_password):
            return jsonify({'error': 'New password must be different from current password'}), 400

        # Update password
        current_user.set_password(new_password)
        current_user.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"Password changed for user: {current_user.username}")

        return jsonify({
            'success': True,
            'message': 'Password changed successfully'
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Password change error: {str(e)}")
        return jsonify({'error': 'Password change failed'}), 500

# -------------------------------
# Utility Routes
# -------------------------------

@auth_bp.route('/api/auth/check-username', methods=['POST'])
def check_username_availability():
    """Check if username is available"""

    data = request.get_json()
    username = data.get('username', '').strip()

    if not username:
        return jsonify({'available': False, 'error': 'Username is required'})

    if not validate_username(username):
        return jsonify({'available': False, 'error': 'Invalid username format'})

    exists = User.query.filter_by(username=username).first() is not None

    return jsonify({
        'available': not exists,
        'username': username
    })

@auth_bp.route('/api/auth/check-email', methods=['POST'])
def check_email_availability():
    """Check if email is available"""

    data = request.get_json()
    email = data.get('email', '').strip().lower()

    if not email:
        return jsonify({'available': False, 'error': 'Email is required'})

    if not validate_email(email):
        return jsonify({'available': False, 'error': 'Invalid email format'})

    exists = User.query.filter_by(email=email).first() is not None

    return jsonify({
        'available': not exists,
        'email': email
    })
