import datetime
from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
from models import db, Project
from firewall_models import FirewallRule, FirewallAccessRequest
from firewall_access import get_access_requests, approve_access_request, reject_access_request, revoke_access_request, revoke_all_approved_requests
import re
import json
import logging

# Set up logging
log = logging.getLogger(__name__)

# Create blueprint
firewall_bp = Blueprint('firewall', __name__)

def check_project_access(project_id):
    """Check if current user has access to the project"""
    project = Project.query.get(project_id)
    if not project:
        return False
    return project.user_id == current_user.id

@firewall_bp.route('/api/projects/<int:project_id>/firewall/rules', methods=['GET'])
@login_required
def get_firewall_rules(project_id):
    """Get all firewall rules for a project"""
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    rules = FirewallRule.query.filter_by(project_id=project_id).order_by(FirewallRule.created_at.desc()).all()
    
    return jsonify({
        "success": True,
        "rules": [rule.to_dict() for rule in rules]
    })

@firewall_bp.route('/api/projects/<int:project_id>/firewall/rules', methods=['POST'])
@login_required
def add_firewall_rule(project_id):
    """Add a new firewall rule"""
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    rule_type = data.get('rule_type')
    value = data.get('value')
    description = data.get('description', '')
    
    # Validate rule type
    if rule_type not in ['path', 'method', 'pattern']:
        return jsonify({"error": "Invalid rule type. Must be 'path', 'method', or 'pattern'"}), 400
    
    # Validate value
    if not value:
        return jsonify({"error": "Rule value cannot be empty"}), 400
    
    # For path rules, ensure they start with /
    if rule_type == 'path' and not value.startswith('/'):
        value = '/' + value
    
    # For method rules, validate HTTP method
    if rule_type == 'method':
        valid_methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
        if value.upper() not in valid_methods:
            return jsonify({"error": f"Invalid HTTP method. Must be one of: {', '.join(valid_methods)}"}), 400
        value = value.upper()
    
    # For pattern rules, validate regex
    if rule_type == 'pattern':
        try:
            re.compile(value)
        except re.error:
            return jsonify({"error": "Invalid regex pattern"}), 400
    
    # Check for duplicate rule
    existing_rule = FirewallRule.query.filter_by(
        project_id=project_id,
        rule_type=rule_type,
        value=value
    ).first()
    
    if existing_rule:
        return jsonify({"error": f"A rule with this {rule_type} and value already exists"}), 409
    
    # Create new rule
    rule = FirewallRule(
        project_id=project_id,
        rule_type=rule_type,
        value=value,
        description=description
    )
    
    db.session.add(rule)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "rule": rule.to_dict()
    })

@firewall_bp.route('/api/projects/<int:project_id>/firewall/rules/<int:rule_id>', methods=['DELETE'])
@login_required
def delete_firewall_rule(project_id, rule_id):
    """Delete a firewall rule"""
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    rule = FirewallRule.query.get(rule_id)
    if not rule:
        return jsonify({"error": "Rule not found"}), 404
    
    if rule.project_id != project_id:
        return jsonify({"error": "Rule does not belong to this project"}), 403
    
    db.session.delete(rule)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Rule deleted successfully"
    })

@firewall_bp.route('/api/projects/<int:project_id>/firewall/import', methods=['POST'])
@login_required
def import_firewall_rules(project_id):
    """Import firewall rules from JSON"""
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Expected format:
    # {
    #   "blocked_paths": ["/admin", "/wp-admin"],
    #   "blocked_methods": ["DELETE"],
    #   "path_patterns": ["^/api/users/\\d+/delete$"]
    # }
    
    blocked_paths = data.get('blocked_paths', [])
    blocked_methods = data.get('blocked_methods', [])
    path_patterns = data.get('path_patterns', [])
    
    # Validate data types
    if not isinstance(blocked_paths, list) or not isinstance(blocked_methods, list) or not isinstance(path_patterns, list):
        return jsonify({"error": "Invalid data format. Expected lists for blocked_paths, blocked_methods, and path_patterns"}), 400
    
    # Track created rules
    created_rules = []
    
    # Process paths
    for path in blocked_paths:
        if not isinstance(path, str):
            continue
            
        # Ensure path starts with /
        if not path.startswith('/'):
            path = '/' + path
            
        # Check for duplicate
        existing = FirewallRule.query.filter_by(
            project_id=project_id,
            rule_type='path',
            value=path
        ).first()
        
        if not existing:
            rule = FirewallRule(
                project_id=project_id,
                rule_type='path',
                value=path,
                description=f"Imported path rule"
            )
            db.session.add(rule)
            created_rules.append(rule)
    
    # Process methods
    valid_methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
    for method in blocked_methods:
        if not isinstance(method, str):
            continue
            
        method = method.upper()
        if method not in valid_methods:
            continue
            
        # Check for duplicate
        existing = FirewallRule.query.filter_by(
            project_id=project_id,
            rule_type='method',
            value=method
        ).first()
        
        if not existing:
            rule = FirewallRule(
                project_id=project_id,
                rule_type='method',
                value=method,
                description=f"Imported method rule"
            )
            db.session.add(rule)
            created_rules.append(rule)
    
    # Process patterns
    for pattern in path_patterns:
        if not isinstance(pattern, str):
            continue
            
        # Validate regex
        try:
            re.compile(pattern)
        except re.error:
            continue
            
        # Check for duplicate
        existing = FirewallRule.query.filter_by(
            project_id=project_id,
            rule_type='pattern',
            value=pattern
        ).first()
        
        if not existing:
            rule = FirewallRule(
                project_id=project_id,
                rule_type='pattern',
                value=pattern,
                description=f"Imported pattern rule"
            )
            db.session.add(rule)
            created_rules.append(rule)
    
    # Commit all changes
    db.session.commit()
    
    # Get all rules after import
    all_rules = FirewallRule.query.filter_by(project_id=project_id).all()
    
    return jsonify({
        "success": True,
        "message": f"Successfully imported {len(created_rules)} rules",
        "rules": [rule.to_dict() for rule in all_rules]
    })

@firewall_bp.route('/api/projects/<int:project_id>/firewall/export', methods=['GET'])
@login_required
def export_firewall_rules(project_id):
    """Export firewall rules to JSON"""
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    rules = FirewallRule.query.filter_by(project_id=project_id).all()
    
    # Group rules by type
    blocked_paths = []
    blocked_methods = []
    path_patterns = []
    
    for rule in rules:
        if rule.rule_type == 'path':
            blocked_paths.append(rule.value)
        elif rule.rule_type == 'method':
            blocked_methods.append(rule.value)
        elif rule.rule_type == 'pattern':
            path_patterns.append(rule.value)
    
    export_data = {
        "blocked_paths": blocked_paths,
        "blocked_methods": blocked_methods,
        "path_patterns": path_patterns,
        "metadata": {
            "project_id": project_id,
            "rule_count": len(rules),
            "export_date": datetime.datetime.utcnow().isoformat()
        }
    }
    
    return jsonify(export_data)

@firewall_bp.route('/api/projects/<int:project_id>/firewall/config', methods=['GET'])
@login_required
def get_firewall_config(project_id):
    """Get firewall configuration for a project"""
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    # Get firewall config from project settings
    firewall_config = project.settings.get('firewall', {}) if hasattr(project, 'settings') and project.settings else {}
    
    # Default config if none exists
    if not firewall_config:
        firewall_config = {
            "enabled": True,
            "block_mode": "default",  # default, whitelist, blacklist
            "notify_on_block": False,
            "log_blocked_requests": True
        }
    
    return jsonify({
        "success": True,
        "config": firewall_config
    })

@firewall_bp.route('/api/projects/<int:project_id>/firewall/config', methods=['POST'])
@login_required
def update_firewall_config(project_id):
    """Update firewall configuration for a project"""
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Initialize settings if needed
    if not hasattr(project, 'settings') or not project.settings:
        project.settings = {}
    
    # Update firewall config
    project.settings['firewall'] = {
        "enabled": data.get('enabled', True),
        "block_mode": data.get('block_mode', 'default'),
        "notify_on_block": data.get('notify_on_block', False),
        "log_blocked_requests": data.get('log_blocked_requests', True)
    }
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Firewall configuration updated",
        "config": project.settings['firewall']
    })

# New endpoints for firewall access requests

@firewall_bp.route('/api/projects/<int:project_id>/firewall/access-requests', methods=['GET'])
@login_required
def get_firewall_access_requests(project_id):
    """Get all firewall access requests for a project"""
    # Check if user has access to the project
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    # Get status filter if provided
    status = request.args.get('status')
    
    # Get access requests
    if status:
        requests = FirewallAccessRequest.query.filter_by(
            project_id=project_id, 
            status=status
        ).order_by(FirewallAccessRequest.created_at.desc()).all()
    else:
        requests = FirewallAccessRequest.query.filter_by(
            project_id=project_id
        ).order_by(FirewallAccessRequest.created_at.desc()).all()
    
    return jsonify({
        "success": True,
        "access_requests": [req.to_dict() for req in requests]
    })

@firewall_bp.route('/api/projects/<int:project_id>/firewall/access-requests/<int:request_id>/approve', methods=['POST'])
@login_required
def approve_firewall_access(project_id, request_id):
    """Approve a firewall access request"""
    # Check if user has access to the project
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    # Get the duration from request data (default to 5 minutes)
    data = request.get_json() or {}
    duration_minutes = data.get('duration_minutes', 5)
    
    # Validate the duration (between 1 and 60 minutes)
    try:
        duration_minutes = int(duration_minutes)
        if duration_minutes < 1 or duration_minutes > 60:
            return jsonify({"error": "Duration must be between 1 and 60 minutes"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid duration value"}), 400
    
    # Check if the access request belongs to the project
    access_req = FirewallAccessRequest.query.get(request_id)
    if not access_req or access_req.project_id != project_id:
        return jsonify({"error": "Access request not found"}), 404
    
    # Approve the request
    access_req.status = "approved"
    access_req.approved_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=duration_minutes)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Access approved for {duration_minutes} minutes",
        "access_request": access_req.to_dict()
    })

@firewall_bp.route('/api/projects/<int:project_id>/firewall/access-requests/<int:request_id>/reject', methods=['POST'])
@login_required
def reject_firewall_access(project_id, request_id):
    """Reject a firewall access request"""
    # Check if user has access to the project
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    # Check if the access request belongs to the project
    access_req = FirewallAccessRequest.query.get(request_id)
    if not access_req or access_req.project_id != project_id:
        return jsonify({"error": "Access request not found"}), 404
    
    # Reject the request
    access_req.status = "rejected"
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Access request rejected",
        "access_request": access_req.to_dict()
    })

# New endpoint to revoke approved access requests
@firewall_bp.route('/api/projects/<int:project_id>/firewall/access-requests/revoke', methods=['POST'])
@login_required
def revoke_approved_access(project_id):
    """Revoke approved access requests"""
    # Check if user has access to the project
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    data = request.get_json() or {}
    
    # Check if we're revoking a specific request or all requests
    request_id = data.get('request_id')
    ip_address = data.get('ip_address')
    revoke_all = data.get('revoke_all', False)
    
    if revoke_all:
        # Revoke all approved requests for this project
        success, count = revoke_all_approved_requests(project_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"Revoked {count} approved access requests",
                "revoked_count": count
            })
        else:
            return jsonify({
                "success": False,
                "message": "Failed to revoke access requests"
            }), 500
    elif request_id:
        # Revoke a specific request
        # First check if it belongs to this project
        access_req = FirewallAccessRequest.query.get(request_id)
        if not access_req or access_req.project_id != project_id:
            return jsonify({"error": "Access request not found"}), 404
        
        success, count = revoke_access_request(request_id=request_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Access request revoked successfully",
                "revoked_count": count
            })
        else:
            return jsonify({
                "success": False,
                "message": "Failed to revoke access request"
            }), 500
    elif ip_address:
        # Revoke all approved requests for this IP address in this project
        success, count = revoke_access_request(project_id=project_id, ip_address=ip_address)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"Revoked {count} approved access requests for IP {ip_address}",
                "revoked_count": count
            })
        else:
            return jsonify({
                "success": False,
                "message": "Failed to revoke access requests"
            }), 500
    else:
        return jsonify({
            "error": "Must specify request_id, ip_address, or revoke_all=true"
        }), 400

# Endpoint to revoke a specific approved request
@firewall_bp.route('/api/projects/<int:project_id>/firewall/access-requests/<int:request_id>/revoke', methods=['POST'])
@login_required
def revoke_specific_access(project_id, request_id):
    """Revoke a specific approved access request"""
    # Check if user has access to the project
    if not check_project_access(project_id):
        return jsonify({"error": "You don't have access to this project"}), 403
    
    # Check if the access request belongs to the project
    access_req = FirewallAccessRequest.query.get(request_id)
    if not access_req or access_req.project_id != project_id:
        return jsonify({"error": "Access request not found"}), 404
    
    # Only approved requests can be revoked
    if access_req.status != "approved":
        return jsonify({"error": "Only approved requests can be revoked"}), 400
    
    # Revoke the request
    success, _ = revoke_access_request(request_id=request_id)
    
    if success:
        return jsonify({
            "success": True,
            "message": "Access request revoked successfully",
            "access_request": access_req.to_dict()
        })
    else:
        return jsonify({
            "success": False,
            "message": "Failed to revoke access request"
        }), 500

# Register the blueprint in your app
# In your app.py or __init__.py:
# from firewall_api import firewall_bp
# app.register_blueprint(firewall_bp)