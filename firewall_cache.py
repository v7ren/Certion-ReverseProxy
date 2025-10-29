# firewall_cache.py
import logging
import time
from typing import Dict, List, Optional

# Set up logging
log = logging.getLogger(__name__)

# Global cache for firewall rules
# Structure: {project_id: {'rules': [...], 'timestamp': time.time()}}
_firewall_cache = {}

# Cache expiration time in seconds
CACHE_EXPIRATION = 60  # 1 minute

def get_cached_rules(project_id: int, force_reload: bool = False) -> Optional[List[dict]]:
    """
    Get cached firewall rules for a project if available
    
    Args:
        project_id: Project ID
        force_reload: Force reload from database
        
    Returns:
        List of rule dictionaries or None if not cached or expired
    """
    global _firewall_cache
    
    now = time.time()
    
    # Check if we need to reload from database
    if (force_reload or 
        project_id not in _firewall_cache or 
        now - _firewall_cache[project_id]['timestamp'] > CACHE_EXPIRATION):
        return None
    
    return _firewall_cache[project_id]['rules']

def set_cached_rules(project_id: int, rules: List[dict]) -> None:
    """
    Set cached firewall rules for a project
    
    Args:
        project_id: Project ID
        rules: List of rule dictionaries
    """
    global _firewall_cache
    
    _firewall_cache[project_id] = {
        'rules': rules,
        'timestamp': time.time()
    }
    log.debug(f"Updated cache with {len(rules)} firewall rules for project {project_id}")

def clear_cache(project_id: Optional[int] = None) -> None:
    """
    Clear the firewall rules cache
    
    Args:
        project_id: Project ID to clear, or None to clear all
    """
    global _firewall_cache
    
    if project_id is None:
        _firewall_cache = {}
        log.debug("Cleared entire firewall rules cache")
    elif project_id in _firewall_cache:
        del _firewall_cache[project_id]
        log.debug(f"Cleared firewall rules cache for project {project_id}")