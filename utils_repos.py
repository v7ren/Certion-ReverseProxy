import os
from werkzeug.utils import secure_filename
from flask import current_app

def repo_disk_path(username: str, repo_name: str) -> str:
    """Get the disk path for a repository"""
    base_path = current_app.config.get('REPOS_FOLDER', 'repos')
    return os.path.join(base_path, username, repo_name)

def safe_subpath(base_path: str, subpath: str) -> str:
    """Safely join base path with subpath, preventing directory traversal"""
    if not subpath:
        return base_path
    
    # Normalize the subpath and remove any leading slashes
    subpath = subpath.strip('/')
    if not subpath:
        return base_path
    
    # Split path and secure each component
    path_parts = []
    for part in subpath.split('/'):
        if part and part != '.' and part != '..':
            path_parts.append(secure_filename(part))
    
    if not path_parts:
        return base_path
    
    result_path = os.path.join(base_path, *path_parts)
    
    # Ensure the result is still within the base path
    try:
        base_real = os.path.realpath(base_path)
        result_real = os.path.realpath(result_path)
        if not result_real.startswith(base_real):
            return None
    except (OSError, ValueError):
        return None
    
    return result_path

def get_file_type(filename: str) -> str:
    """Get file type based on extension"""
    if '.' not in filename:
        return 'unknown'
    
    ext = filename.rsplit('.', 1)[1].lower()
    
    # Code files
    code_extensions = {
        'py', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'scss', 'less',
        'json', 'xml', 'yaml', 'yml', 'md', 'txt', 'sql', 'sh', 'bat',
        'php', 'rb', 'go', 'rs', 'cpp', 'c', 'h', 'java', 'kt', 'swift'
    }
    
    # Image files
    image_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'}
    
    # Document files
    doc_extensions = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'}
    
    # Archive files
    archive_extensions = {'zip', 'tar', 'gz', 'rar', '7z', 'bz2'}
    
    if ext in code_extensions:
        return 'code'
    elif ext in image_extensions:
        return 'image'
    elif ext in doc_extensions:
        return 'document'
    elif ext in archive_extensions:
        return 'archive'
    else:
        return 'unknown'

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    
    while size >= 1024.0 and i < len(size_names) - 1:
        size /= 1024.0
        i += 1
    
    return f"{size:.1f} {size_names[i]}"
