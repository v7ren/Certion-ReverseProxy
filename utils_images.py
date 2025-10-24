import os, secrets
from PIL import Image
from werkzeug.utils import secure_filename
from flask import current_app

ALLOWED_IMAGE_EXTS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_image(filename: str) -> bool:
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_IMAGE_EXTS

def user_upload_dir(user_id: int) -> str:
    base = current_app.config['UPLOAD_FOLDER']
    path = os.path.join(base, str(user_id))
    os.makedirs(path, exist_ok=True)
    return path

def random_name(ext: str) -> str:
    return secrets.token_hex(16) + '.' + ext

def save_user_image(file_storage, user_id: int):
    """
    Saves original image, creates thumbnail.
    Returns dict with metadata.
    Raises ValueError on invalid input.
    """
    if file_storage.filename == '':
        raise ValueError("Empty filename.")
    orig_name = secure_filename(file_storage.filename)
    ext = orig_name.rsplit('.', 1)[1].lower()
    if not allowed_image(orig_name):
        raise ValueError("Unsupported image type.")

    # Read fully to check size
    file_storage.stream.seek(0, 2)
    size_bytes = file_storage.stream.tell()
    file_storage.stream.seek(0)

    # Limit (optional custom)
    max_bytes = current_app.config.get('GALLERY_MAX_FILE_BYTES', 5 * 1024 * 1024)
    if size_bytes > max_bytes:
        raise ValueError("File too large.")

    storage_name = random_name(ext)
    user_dir = user_upload_dir(user_id)
    full_path = os.path.join(user_dir, storage_name)
    file_storage.save(full_path)

    # Verify it is an image
    try:
        with Image.open(full_path) as img:
            img.verify()  # quick integrity check
    except Exception:
        try:
            os.remove(full_path)
        except OSError:
            pass
        raise ValueError("Corrupted or invalid image.")

    # Re-open for dimension + orientation fix
    with Image.open(full_path) as img:
        img = _auto_orient(img)
        width, height = img.size
        # (Optional) store normalized version (overwriting original if orientation changed)
        img.save(full_path)

        # Thumbnail
        thumb_name = storage_name.rsplit('.', 1)[0] + "_thumb.jpg"
        thumb_path = os.path.join(user_dir, thumb_name)
        thumb = img.copy()
        thumb.thumbnail((400, 400))
        thumb.save(thumb_path, 'JPEG', quality=82, optimize=True)

    return {
        "original_filename": orig_name,
        "stored_filename": storage_name,
        "thumb_filename": thumb_name,
        "file_size": size_bytes,
        "mime_type": file_storage.mimetype,
        "width": width,
        "height": height
    }

def _auto_orient(img: Image.Image) -> Image.Image:
    try:
        exif = img.getexif()
        orientation = exif.get(0x0112)
        rotate_map = {3: 180, 6: 270, 8: 90}
        if orientation in rotate_map:
            img = img.rotate(rotate_map[orientation], expand=True)
    except Exception:
        pass
    return img
