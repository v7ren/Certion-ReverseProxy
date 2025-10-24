#subdomain.py
import re
import logging
from sqlalchemy.orm import Session
from typing import Optional

log = logging.getLogger(__name__)

def extract_subdomain(host: str, domain: str) -> Optional[str]:
    """
    Extract subdomain from host header
    
    Returns:
        - subdomain string if valid subdomain
        - None if accessing root domain
        - "__invalid__" if invalid domain
    """
    host_without_port = (host or "").lower().split(":")[0]
    if host_without_port.endswith(f".{domain}"):
        return host_without_port[:-(len(domain) + 1)]
    if host_without_port == domain:
        return None
    return "__invalid__"


def validate_subdomain_name(name: str) -> bool:
    """
    Validate subdomain name format
    
    Args:
        name: subdomain name to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not name:
        return False
    
    # Only allow alphanumeric, hyphens
    if not re.match(r'^[a-z0-9-]+$', name):
        return False
    
    # Cannot start or end with hyphen
    if name.startswith('-') or name.endswith('-'):
        return False
    
    # Cannot have consecutive hyphens
    if '--' in name:
        return False
    
    return True


def generate_subdomain(project_name: str, username: str, db: Session, project_model) -> str:
    """
    Generate a unique subdomain for a project
    
    Args:
        project_name: name of the project
        username: username of the owner
        db: database session
        project_model: Project SQLAlchemy model
        
    Returns:
        unique subdomain string
    """
    # Create base subdomain
    subdomain = f"{project_name}-{username}".lower()
    subdomain = re.sub(r'[^a-z0-9-]', '', subdomain.replace(' ', '-'))
    subdomain = re.sub(r'-+', '-', subdomain)
    subdomain = subdomain.strip('-')
    
    # Ensure it's valid
    if not validate_subdomain_name(subdomain):
        subdomain = f"project-{username}".lower()
        subdomain = re.sub(r'[^a-z0-9-]', '', subdomain)
    
    # Check uniqueness
    original_subdomain = subdomain
    counter = 1
    
    while db.query(project_model).filter_by(subdomain=subdomain).first():
        subdomain = f"{original_subdomain}-{counter}"
        counter += 1
        
        # Safety limit
        if counter > 1000:
            import secrets
            subdomain = f"{original_subdomain}-{secrets.token_hex(4)}"
            break
    
    return subdomain


def normalize_subdomain(subdomain: str) -> str:
    """
    Normalize subdomain to valid format
    
    Args:
        subdomain: raw subdomain string
        
    Returns:
        normalized subdomain
    """
    subdomain = subdomain.lower()
    subdomain = re.sub(r'[^a-z0-9-]', '', subdomain.replace(' ', '-'))
    subdomain = re.sub(r'-+', '-', subdomain)
    subdomain = subdomain.strip('-')
    return subdomain
