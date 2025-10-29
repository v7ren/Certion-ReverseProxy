# firewall_aiohttp.py
import os
import re
import logging
from typing import Dict, List, Optional, Tuple, Union
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from firewall_access import is_ip_temporarily_approved, create_access_request

# Import the unified cache manager
from firewall_cache import get_cached_rules, set_cached_rules, clear_cache

# Set up logging
log = logging.getLogger(__name__)

# Get the database path from your app configuration
INSTANCE_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
DATABASE_PATH = os.path.join(INSTANCE_FOLDER, 'app.db')
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Create a direct connection to the database
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Get a database session that doesn't depend on Flask context"""
    db = SessionLocal()
    try:
        return db
    except:
        db.close()
        raise

def _get_project_rules_from_db(project_id: int, firewall_rule_model) -> List[dict]:
    """
    Get firewall rules for a project from the database
    
    Args:
        project_id: Project ID
        firewall_rule_model: FirewallRule model class
        
    Returns:
        List of rule dictionaries
    """
    db = get_db()
    try:
        try:
            rules = db.query(firewall_rule_model).filter_by(project_id=project_id).all()
            return [rule.to_dict() for rule in rules]
        except Exception as e:
            # Handle the case where the table doesn't exist yet
            if "no such table" in str(e):
                log.warning(f"Firewall rules table doesn't exist yet: {e}")
                return []
            raise
    finally:
        db.close()

def get_project_firewall_rules(project_id: int, firewall_rule_model, force_reload=False) -> List[dict]:
    """
    Get firewall rules for a project with caching
    
    Args:
        project_id: Project ID
        firewall_rule_model: FirewallRule model class
        force_reload: Force reload from database
        
    Returns:
        List of rule dictionaries
    """
    # Try to get from cache first
    cached_rules = get_cached_rules(project_id, force_reload)
    if cached_rules is not None:
        return cached_rules
    
    # Not in cache or expired, load from database
    rules = _get_project_rules_from_db(project_id, firewall_rule_model)
    
    # Update cache
    set_cached_rules(project_id, rules)
    
    return rules

def is_request_blocked(project_id: int, firewall_rule_model, method: str, path: str, 
                      client_ip: str = None) -> Tuple[bool, str]:
    """
    Check if a request should be blocked based on firewall rules
    
    Args:
        project_id: Project ID
        firewall_rule_model: FirewallRule model class
        method: HTTP method
        path: Request path
        client_ip: Client IP address (for temporary approval checks)
        
    Returns:
        Tuple of (is_blocked, reason)
    """
    try:
        # If client IP is provided, check for temporary approval
        if client_ip:
            db_session = get_db()
            try:
                if is_ip_temporarily_approved(project_id, client_ip, method, path, db_session=db_session):
                    return False, ""
            finally:
                db_session.close()
        
        rules = get_project_firewall_rules(project_id, firewall_rule_model)
        
        # Group rules by type for more efficient checking
        path_rules = []
        pattern_rules = []
        method_rules = []
        
        for rule in rules:
            if rule['rule_type'] == 'path':
                path_rules.append(rule)
            elif rule['rule_type'] == 'pattern':
                pattern_rules.append(rule)
            elif rule['rule_type'] == 'method':
                method_rules.append(rule)
        
        # Check method rules first (fastest check)
        for rule in method_rules:
            if method.upper() == rule['value'].upper():
                if client_ip:
                    # Log the blocked request for potential approval
                    db_session = get_db()
                    try:
                        create_access_request(
                            project_id=project_id,
                            ip_address=client_ip,
                            method=method,
                            path=path,
                            rule_id=rule['id'],
                            block_reason=f"HTTP method '{method}' is blocked by firewall rule ID {rule['id']}",
                            db_session=db_session
                        )
                    finally:
                        db_session.close()
                return True, f"HTTP method '{method}' is blocked by firewall rule ID {rule['id']}"
        
        # Check path rules (exact match or prefix)
        for rule in path_rules:
            blocked_path = rule['value']
            if path == blocked_path or path.startswith(blocked_path + '/'):
                if client_ip:
                    # Log the blocked request for potential approval
                    db_session = get_db()
                    try:
                        create_access_request(
                            project_id=project_id,
                            ip_address=client_ip,
                            method=method,
                            path=path,
                            rule_id=rule['id'],
                            block_reason=f"Path '{path}' matches blocked path '{blocked_path}' (rule ID {rule['id']})",
                            db_session=db_session
                        )
                    finally:
                        db_session.close()
                return True, f"Path '{path}' matches blocked path '{blocked_path}' (rule ID {rule['id']})"
        
        # Check pattern rules (regex - most expensive check)
        for rule in pattern_rules:
            pattern = rule['value']
            try:
                if re.match(pattern, path):
                    if client_ip:
                        # Log the blocked request for potential approval
                        db_session = get_db()
                        try:
                            create_access_request(
                                project_id=project_id,
                                ip_address=client_ip,
                                method=method,
                                path=path,
                                rule_id=rule['id'],
                                block_reason=f"Path '{path}' matches blocked pattern '{pattern}' (rule ID {rule['id']})",
                                db_session=db_session
                            )
                        finally:
                            db_session.close()
                    return True, f"Path '{path}' matches blocked pattern '{pattern}' (rule ID {rule['id']})"
            except re.error:
                log.warning(f"Invalid regex pattern in firewall rule ID {rule['id']}: {pattern}")
        
        return False, ""
    except Exception as e:
        log.error(f"Error checking firewall rules: {e}", exc_info=True)
        # If there's an error, allow the request through
        return False, ""
# Export the clear_cache function from the unified cache manager
# This ensures that any code calling firewall_aiohttp.clear_cache() will use the unified cache