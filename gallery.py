from flask import Blueprint, current_app, jsonify, request, abort
from flask_login import login_required, current_user
from models import db, Photo
from sqlalchemy import func
from utils_images import save_user_image, delete_user_image
import os

gallery_bp = Blueprint('gallery', __name__, url_prefix='/gallery')

@gallery_bp.route('/api/photos', methods=['GET'])
@login_required
def api_gallery_photos():
    """API endpoint for React frontend to get photos"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 24, type=int)
    
    # Limit per_page to prevent abuse
    per_page = min(per_page, 100)
    
    photos_q = Photo.query.filter_by(user_id=current_user.id).order_by(Photo.created_at.desc())
    total = photos_q.count()
    photos = photos_q.offset((page - 1) * per_page).limit(per_page).all()
    
    photo_data = []
    for photo in photos:
        photo_data.append({
            'id': photo.id,
            'filename': photo.filename,
            'url': f'/uploads/users/{current_user.id}/{photo.filename}',
            'thumbnail_url': f'/uploads/users/{current_user.id}/thumbs/{photo.filename}',
            'created_at': photo.created_at.isoformat(),
            'size': getattr(photo, 'size', 0),
            'width': getattr(photo, 'width', 0),
            'height': getattr(photo, 'height', 0)
        })
    
    return jsonify({
        'photos': photo_data,
        'total': total,
        'page': page,
        'per_page': per_page,
        'has_next': page * per_page < total,
        'has_prev': page > 1,
        'total_pages': (total + per_page - 1) // per_page
    })

@gallery_bp.route('/api/upload', methods=['POST'])
@login_required
def api_upload_photo():
    """API endpoint for uploading photos"""
    if 'photos' not in request.files:
        return jsonify({'error': 'No photos provided'}), 400
    
    files = request.files.getlist('photos')
    uploaded_photos = []
    errors = []
    
    for file in files:
        if file.filename:
            try:
                filename = save_user_image(file, current_user.id)
                if filename:
                    # Save to database
                    photo = Photo(
                        filename=filename,
                        user_id=current_user.id
                    )
                    db.session.add(photo)
                    uploaded_photos.append({
                        'filename': filename,
                        'url': f'/uploads/users/{current_user.id}/{filename}',
                        'thumbnail_url': f'/uploads/users/{current_user.id}/thumbs/{filename}'
                    })
                else:
                    errors.append(f'Failed to process {file.filename}')
            except Exception as e:
                errors.append(f'Error uploading {file.filename}: {str(e)}')
    
    if uploaded_photos:
        db.session.commit()
    
    return jsonify({
        'success': len(uploaded_photos) > 0,
        'uploaded': uploaded_photos,
        'errors': errors,
        'total_uploaded': len(uploaded_photos)
    })

@gallery_bp.route('/api/photos/<int:photo_id>', methods=['GET'])
@login_required
def api_get_photo(photo_id):
    """Get single photo details"""
    photo = Photo.query.filter_by(id=photo_id, user_id=current_user.id).first_or_404()
    
    return jsonify({
        'id': photo.id,
        'filename': photo.filename,
        'url': f'/uploads/users/{current_user.id}/{photo.filename}',
        'thumbnail_url': f'/uploads/users/{current_user.id}/thumbs/{photo.filename}',
        'created_at': photo.created_at.isoformat(),
        'size': getattr(photo, 'size', 0),
        'width': getattr(photo, 'width', 0),
        'height': getattr(photo, 'height', 0)
    })

@gallery_bp.route('/api/photos/<int:photo_id>', methods=['DELETE'])
@login_required
def api_delete_photo(photo_id):
    """Delete a photo"""
    photo = Photo.query.filter_by(id=photo_id, user_id=current_user.id).first_or_404()
    
    # Delete files from disk
    success = delete_user_image(photo.filename, current_user.id)
    
    # Delete from database
    db.session.delete(photo)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Photo deleted successfully',
        'files_deleted': success
    })

@gallery_bp.route('/api/photos/bulk-delete', methods=['POST'])
@login_required
def api_bulk_delete_photos():
    """Delete multiple photos"""
    data = request.get_json()
    if not data or 'photo_ids' not in data:
        return jsonify({'error': 'No photo IDs provided'}), 400
    
    photo_ids = data['photo_ids']
    if not isinstance(photo_ids, list):
        return jsonify({'error': 'photo_ids must be a list'}), 400
    
    # Get photos belonging to current user
    photos = Photo.query.filter(
        Photo.id.in_(photo_ids),
        Photo.user_id == current_user.id
    ).all()
    
    deleted_count = 0
    errors = []
    
    for photo in photos:
        try:
            # Delete files from disk
            delete_user_image(photo.filename, current_user.id)
            
            # Delete from database
            db.session.delete(photo)
            deleted_count += 1
        except Exception as e:
            errors.append(f'Error deleting photo {photo.id}: {str(e)}')
    
    if deleted_count > 0:
        db.session.commit()
    
    return jsonify({
        'success': deleted_count > 0,
        'deleted_count': deleted_count,
        'errors': errors,
        'message': f'Deleted {deleted_count} photos'
    })

@gallery_bp.route('/api/stats', methods=['GET'])
@login_required
def api_gallery_stats():
    """Get gallery statistics"""
    total_photos = Photo.query.filter_by(user_id=current_user.id).count()
    
    # Calculate total size if you have size field
    total_size = 0
    if hasattr(Photo, 'size'):
        result = db.session.query(func.sum(Photo.size)).filter_by(user_id=current_user.id).scalar()
        total_size = result or 0
    
    return jsonify({
        'total_photos': total_photos,
        'total_size': total_size,
        'total_size_formatted': f"{total_size / (1024*1024):.1f} MB" if total_size else "0 MB"
    })
