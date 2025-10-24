from flask import Blueprint, jsonify, request, current_app, send_file, abort
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from models import db, Repo, RepoFile, RepoStar, RepoFork, User
import os
import shutil
import mimetypes
from datetime import datetime
import logging

# Setup logging
logger = logging.getLogger("repo")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

repo_bp = Blueprint('repo', __name__, url_prefix='/r')

# Constants for file handling
ALLOWED_FILE_EXTENSIONS = {
    'txt', 'md', 'py', 'js', 'html', 'css', 'json', 'xml', 'yml', 'yaml',
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'pdf', 'zip', 'tar', 'gz'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB per file

def allowed_file(filename):
    """Check if file extension is allowed for repository uploads"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_FILE_EXTENSIONS

def get_repo_path(repo):
    """Get the file system path for a repository"""
    repo_dir = os.path.join(current_app.config.get('REPO_STORAGE_PATH', 'repos'), 
                           str(repo.owner_id), repo.name)
    os.makedirs(repo_dir, exist_ok=True)
    return repo_dir

def serialize_repo(repo, user=None):
    """Serialize repository object for API response"""
    return {
        'id': repo.id,
        'name': repo.name,
        'full_name': repo.full_name,
        'description': repo.description,
        'is_private': repo.is_private,
        'language': repo.language,
        'stars_count': repo.stars_count,
        'forks_count': repo.forks_count,
        'issues_count': repo.issues_count,
        'commits_count': repo.commits_count,
        'size': repo.size,
        'created_at': repo.created_at.isoformat(),
        'updated_at': repo.updated_at.isoformat(),
        'owner': {
            'username': repo.owner.username,
            'avatar_url': repo.owner.avatar_url() if callable(repo.owner.avatar_url) else repo.owner.avatar_url
        },
        'is_starred': repo.is_starred_by(user) if user else False,
        'is_forked': repo.is_forked_by(user) if user else False
    }

# Repository Management Endpoints

@repo_bp.route('/api/repos', methods=['GET'])
@login_required
def get_repositories():
    """Fetch all repositories for the current user"""
    try:
        # Get user's own repositories and public repositories they have access to
        user_repos = Repo.query.filter_by(owner_id=current_user.id).all()
        public_repos = Repo.query.filter(
            Repo.is_private == False,
            Repo.owner_id != current_user.id
        ).limit(50).all()  # Limit public repos for performance
        
        all_repos = user_repos + public_repos
        
        repos_data = [serialize_repo(repo, current_user) for repo in all_repos]
        
        return jsonify({
            'repos': repos_data,
            'total': len(repos_data)
        })
        
    except Exception as e:
        logger.error(f"Error fetching repositories: {str(e)}")
        return jsonify({'error': 'Failed to fetch repositories'}), 500

@repo_bp.route('/new', methods=['POST'])
@login_required
def create_repository():
    """Create a new repository"""
    try:
        # Handle form data from the React component
        name = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        is_private = 'is_private' in request.form or request.form.get('is_private') == 'on'
        language = request.form.get('language', '').strip()
        
        # Validation
        if not name:
            return jsonify({'error': 'Repository name is required'}), 400
            
        if len(name) > 100:
            return jsonify({'error': 'Repository name too long'}), 400
            
        # Check if repository already exists for this user
        existing_repo = Repo.query.filter_by(owner_id=current_user.id, name=name).first()
        if existing_repo:
            return jsonify({'error': 'Repository with this name already exists'}), 409
        
        # Create repository
        repo = Repo(
            owner_id=current_user.id,
            name=name,
            description=description,
            is_private=is_private,
            language=language
        )
        
        db.session.add(repo)
        db.session.commit()
        
        # Create repository directory
        repo_path = get_repo_path(repo)
        
        # Create initial README if description provided
        if description:
            readme_path = os.path.join(repo_path, 'README.md')
            with open(readme_path, 'w', encoding='utf-8') as f:
                f.write(f"# {name}\n\n{description}\n")
            
            # Add README to database
            readme_file = RepoFile(
                repo_id=repo.id,
                path='README.md',
                filename='README.md',
                size=len(description.encode('utf-8')) + len(name.encode('utf-8')) + 10,
                content_type='text/markdown'
            )
            db.session.add(readme_file)
            repo.commits_count = 1
            db.session.commit()
        
        logger.info(f"Repository created: {repo.full_name}")
        
        return jsonify({
            'success': True,
            'message': 'Repository created successfully',
            'repository': serialize_repo(repo, current_user)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating repository: {str(e)}")
        return jsonify({'error': 'Failed to create repository'}), 500

# File Management Endpoints

@repo_bp.route('/api/repos/<int:repo_id>/files', methods=['GET'])
@login_required
def get_repo_files(repo_id):
    """Get files and directories in a repository path"""
    try:
        repo = Repo.query.get_or_404(repo_id)
        
        # Check access permissions
        if repo.is_private and repo.owner_id != current_user.id:
            return jsonify({'error': 'Access denied'}), 403
        
        path = request.args.get('path', '').strip('/')
        repo_path = get_repo_path(repo)
        full_path = os.path.join(repo_path, path) if path else repo_path
        
        # Security check - ensure path is within repo directory
        if not os.path.abspath(full_path).startswith(os.path.abspath(repo_path)):
            return jsonify({'error': 'Invalid path'}), 400
        
        entries = []
        
        if os.path.exists(full_path) and os.path.isdir(full_path):
            for item in sorted(os.listdir(full_path)):
                if item.startswith('.'):  # Skip hidden files
                    continue
                    
                item_path = os.path.join(full_path, item)
                relative_path = os.path.join(path, item) if path else item
                
                if os.path.isdir(item_path):
                    entries.append({
                        'type': 'dir',
                        'name': item,
                        'path': relative_path.replace('\\', '/')
                    })
                else:
                    file_size = os.path.getsize(item_path)
                    entries.append({
                        'type': 'file',
                        'name': item,
                        'path': relative_path.replace('\\', '/'),
                        'size': file_size
                    })
        
        return jsonify({
            'entries': entries,
            'current_path': path
        })
        
    except Exception as e:
        logger.error(f"Error fetching repository files: {str(e)}")
        return jsonify({'error': 'Failed to fetch files'}), 500

@repo_bp.route('/api/repos/<int:repo_id>/upload', methods=['POST'])
@login_required
def upload_files(repo_id):
    """Upload files to a repository"""
    try:
        repo = Repo.query.get_or_404(repo_id)
        
        # Check permissions - only owner can upload
        if repo.owner_id != current_user.id:
            return jsonify({'error': 'Access denied'}), 403
        
        upload_path = request.form.get('path', '').strip('/')
        files = request.files.getlist('files')
        
        if not files or all(f.filename == '' for f in files):
            return jsonify({'error': 'No files selected'}), 400
        
        repo_path = get_repo_path(repo)
        target_dir = os.path.join(repo_path, upload_path) if upload_path else repo_path
        
        # Security check
        if not os.path.abspath(target_dir).startswith(os.path.abspath(repo_path)):
            return jsonify({'error': 'Invalid upload path'}), 400
        
        os.makedirs(target_dir, exist_ok=True)
        
        uploaded_files = []
        total_size = 0
        
        for file in files:
            if file.filename == '':
                continue
                
            if not allowed_file(file.filename):
                return jsonify({'error': f'File type not allowed: {file.filename}'}), 400
            
            # Use secure_filename for security [[0]](#__0)
            filename = secure_filename(file.filename)
            if not filename:
                continue
            
            file_path = os.path.join(target_dir, filename)
            relative_path = os.path.join(upload_path, filename) if upload_path else filename
            
            # Check file size before saving [[2]](#__2)
            file.seek(0, 2)  # Seek to end
            file_size = file.tell()
            file.seek(0)  # Reset to beginning
            
            if file_size > MAX_FILE_SIZE:
                return jsonify({'error': f'File too large: {filename}'}), 400
            
            # Save file
            file.save(file_path)
            
            # Add to database
            mime_type, _ = mimetypes.guess_type(filename)
            repo_file = RepoFile(
                repo_id=repo.id,
                path=relative_path.replace('\\', '/'),
                filename=filename,
                size=file_size,
                content_type=mime_type or 'application/octet-stream'
            )
            
            db.session.add(repo_file)
            uploaded_files.append(filename)
            total_size += file_size
        
        # Update repository stats
        repo.updated_at = datetime.utcnow()
        repo.size += total_size // 1024  # Convert to KB
        repo.commits_count += 1
        
        db.session.commit()
        
        logger.info(f"Files uploaded to {repo.full_name}: {uploaded_files}")
        
        return jsonify({
            'success': True,
            'message': f'Successfully uploaded {len(uploaded_files)} files',
            'files': uploaded_files
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error uploading files: {str(e)}")
        return jsonify({'error': 'Failed to upload files'}), 500

# Repository Actions

@repo_bp.route('/api/repos/<int:repo_id>/star', methods=['POST'])
@login_required
def star_repository(repo_id):
    """Star a repository"""
    try:
        repo = Repo.query.get_or_404(repo_id)
        
        # Check if already starred
        existing_star = RepoStar.query.filter_by(repo_id=repo_id, user_id=current_user.id).first()
        if existing_star:
            return jsonify({'error': 'Repository already starred'}), 400
        
        # Create star
        star = RepoStar(repo_id=repo_id, user_id=current_user.id)
        db.session.add(star)
        
        # Update count
        repo.stars_count += 1
        db.session.commit()
        
        return jsonify({
            'starred': True,
            'stars_count': repo.stars_count
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error starring repository: {str(e)}")
        return jsonify({'error': 'Failed to star repository'}), 500

@repo_bp.route('/api/repos/<int:repo_id>/star', methods=['DELETE'])
@login_required
def unstar_repository(repo_id):
    """Unstar a repository"""
    try:
        repo = Repo.query.get_or_404(repo_id)
        
        # Find and remove star
        star = RepoStar.query.filter_by(repo_id=repo_id, user_id=current_user.id).first()
        if not star:
            return jsonify({'error': 'Repository not starred'}), 400
        
        db.session.delete(star)
        
        # Update count
        repo.stars_count = max(0, repo.stars_count - 1)
        db.session.commit()
        
        return jsonify({
            'starred': False,
            'stars_count': repo.stars_count
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error unstarring repository: {str(e)}")
        return jsonify({'error': 'Failed to unstar repository'}), 500

@repo_bp.route('/api/repos/<int:repo_id>/fork', methods=['POST'])
@login_required
def fork_repository(repo_id):
    """Fork a repository"""
    try:
        original_repo = Repo.query.get_or_404(repo_id)
        
        # Check if user can fork (can't fork own repo, can't fork private repo without access)
        if original_repo.owner_id == current_user.id:
            return jsonify({'error': 'Cannot fork your own repository'}), 400
        
        if original_repo.is_private:
            return jsonify({'error': 'Cannot fork private repository'}), 403
        
        # Check if already forked
        existing_fork = RepoFork.query.filter_by(repo_id=repo_id, user_id=current_user.id).first()
        if existing_fork:
            return jsonify({'error': 'Repository already forked'}), 400
        
        # Create forked repository
        fork_name = original_repo.name
        counter = 1
        while Repo.query.filter_by(owner_id=current_user.id, name=fork_name).first():
            fork_name = f"{original_repo.name}-{counter}"
            counter += 1
        
        forked_repo = Repo(
            owner_id=current_user.id,
            name=fork_name,
            description=f"Forked from {original_repo.full_name}",
            is_private=False,  # Forks are typically public
            language=original_repo.language
        )
        
        db.session.add(forked_repo)
        db.session.flush()  # Get the ID
        
        # Copy files
        original_path = get_repo_path(original_repo)
        fork_path = get_repo_path(forked_repo)
        
        if os.path.exists(original_path):
            shutil.copytree(original_path, fork_path, dirs_exist_ok=True)
            
            # Copy file records
            original_files = RepoFile.query.filter_by(repo_id=original_repo.id).all()
            for file_record in original_files:
                fork_file = RepoFile(
                    repo_id=forked_repo.id,
                    path=file_record.path,
                    filename=file_record.filename,
                    size=file_record.size,
                    content_type=file_record.content_type
                )
                db.session.add(fork_file)
        
        # Create fork relationship
        fork_relation = RepoFork(
            repo_id=original_repo.id,
            user_id=current_user.id,
            forked_repo_id=forked_repo.id
        )
        db.session.add(fork_relation)
        
        # Update original repo fork count
        original_repo.forks_count += 1
        
        db.session.commit()
        
        logger.info(f"Repository forked: {original_repo.full_name} -> {forked_repo.full_name}")
        
        return jsonify({
            'success': True,
            'message': 'Repository forked successfully',
            'fork': {
                'id': forked_repo.id,
                'full_name': forked_repo.full_name
            }
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error forking repository: {str(e)}")
        return jsonify({'error': 'Failed to fork repository'}), 500

# File Access Endpoints

@repo_bp.route('/<username>/<repo_name>/raw/<path:file_path>')
def serve_raw_file(username, repo_name, file_path):
    """Serve raw file content"""
    try:
        # Find repository
        user = User.query.filter_by(username=username).first_or_404()
        repo = Repo.query.filter_by(owner_id=user.id, name=repo_name).first_or_404()
        
        # Check access permissions
        if repo.is_private and (not current_user.is_authenticated or repo.owner_id != current_user.id):
            abort(403)
        
        repo_path = get_repo_path(repo)
        full_file_path = os.path.join(repo_path, file_path)
        
        # Security check
        if not os.path.abspath(full_file_path).startswith(os.path.abspath(repo_path)):
            abort(400)
        
        if not os.path.exists(full_file_path) or os.path.isdir(full_file_path):
            abort(404)
        
        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(full_file_path)
        
        return send_file(full_file_path, mimetype=mime_type)
        
    except Exception as e:
        logger.error(f"Error serving raw file: {str(e)}")
        abort(500)

@repo_bp.route('/<username>/<repo_name>/download/<path:file_path>')
def download_file(username, repo_name, file_path):
    """Force download a file"""
    try:
        # Find repository
        user = User.query.filter_by(username=username).first_or_404()
        repo = Repo.query.filter_by(owner_id=user.id, name=repo_name).first_or_404()
        
        # Check access permissions
        if repo.is_private and (not current_user.is_authenticated or repo.owner_id != current_user.id):
            abort(403)
        
        repo_path = get_repo_path(repo)
        full_file_path = os.path.join(repo_path, file_path)
        
        # Security check
        if not os.path.abspath(full_file_path).startswith(os.path.abspath(repo_path)):
            abort(400)
        
        if not os.path.exists(full_file_path) or os.path.isdir(full_file_path):
            abort(404)
        
        filename = os.path.basename(file_path)
        return send_file(full_file_path, as_attachment=True, download_name=filename)
        
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        abort(500)
