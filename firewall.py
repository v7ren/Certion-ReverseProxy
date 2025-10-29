# firewall.py
import re
import logging
from typing import Dict, List, Optional, Tuple, Union
from sqlalchemy.orm import Session

# Import the unified cache manager
from firewall_cache import get_cached_rules, set_cached_rules, clear_cache

# Set up logging
log = logging.getLogger(__name__)

def _get_project_rules_from_db(db: Session, project_id: int, firewall_rule_model) -> List[dict]:
    """
    Get firewall rules for a project from the database
    
    Args:
        db: Database session
        project_id: Project ID
        firewall_rule_model: FirewallRule model class
        
    Returns:
        List of rule dictionaries
    """
    rules = db.query(firewall_rule_model).filter_by(project_id=project_id).all()
    return [rule.to_dict() for rule in rules]

def get_project_firewall_rules(db: Session, project_id: int, firewall_rule_model, force_reload=False) -> List[dict]:
    """
    Get firewall rules for a project with caching
    
    Args:
        db: Database session
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
    rules = _get_project_rules_from_db(db, project_id, firewall_rule_model)
    
    # Update cache
    set_cached_rules(project_id, rules)
    
    return rules

def is_request_blocked(db: Session, project_id: int, firewall_rule_model, method: str, path: str) -> Tuple[bool, str]:
    """
    Check if a request should be blocked based on firewall rules
    
    Args:
        db: Database session
        project_id: Project ID
        firewall_rule_model: FirewallRule model class
        method: HTTP method
        path: Request path
        
    Returns:
        Tuple of (is_blocked, reason)
    """
    rules = get_project_firewall_rules(db, project_id, firewall_rule_model)
    
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
            return True, f"HTTP method '{method}' is blocked by firewall rule ID {rule['id']}"
    
    # Check path rules (exact match or prefix)
    for rule in path_rules:
        blocked_path = rule['value']
        if path == blocked_path or path.startswith(blocked_path + '/'):
            return True, f"Path '{path}' matches blocked path '{blocked_path}' (rule ID {rule['id']})"
    
    # Check pattern rules (regex - most expensive check)
    for rule in pattern_rules:
        pattern = rule['value']
        try:
            if re.match(pattern, path):
                return True, f"Path '{path}' matches blocked pattern '{pattern}' (rule ID {rule['id']})"
        except re.error:
            log.warning(f"Invalid regex pattern in firewall rule ID {rule['id']}: {pattern}")
    
    return False, ""

# Export the clear_cache function from the unified cache manager
# This ensures that any code calling firewall.clear_cache() will use the unified cache