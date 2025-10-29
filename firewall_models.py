from models import db
import datetime
import json

class FirewallRule(db.Model):
    """Firewall rules for projects"""
    __tablename__ = "firewall_rules"
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    rule_type = db.Column(db.String(20), nullable=False)  # 'path', 'method', 'pattern'
    value = db.Column(db.String(500), nullable=False)     # The actual path, method or pattern to block
    description = db.Column(db.String(255))               # Optional description of the rule
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationship with Project
    project = db.relationship('Project', backref=db.backref('firewall_rules', lazy='dynamic', cascade='all, delete-orphan'))
    
    def to_dict(self):
        """Convert rule to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'rule_type': self.rule_type,
            'value': self.value,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class FirewallAccessRequest(db.Model):
    """Track requests to access firewall-blocked resources"""
    __tablename__ = "firewall_access_requests"
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)  # IPv4 or IPv6 address
    method = db.Column(db.String(20), nullable=False)      # HTTP method
    path = db.Column(db.String(500), nullable=False)       # Requested path
    rule_id = db.Column(db.Integer, db.ForeignKey('firewall_rules.id', ondelete='SET NULL'), nullable=True)
    block_reason = db.Column(db.String(500))              # Reason for blocking
    status = db.Column(db.String(20), default="pending")  # pending, approved, rejected
    approved_until = db.Column(db.DateTime, nullable=True) # When approval expires
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', backref=db.backref('firewall_access_requests', lazy='dynamic', cascade='all, delete-orphan'))
    rule = db.relationship('FirewallRule', backref=db.backref('access_requests', lazy='dynamic'), foreign_keys=[rule_id])
    
    def to_dict(self):
        """Convert access request to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'ip_address': self.ip_address,
            'method': self.method,
            'path': self.path,
            'rule_id': self.rule_id,
            'block_reason': self.block_reason,
            'status': self.status,
            'approved_until': self.approved_until.isoformat() if self.approved_until else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Helper functions for working with firewall rules

def get_project_firewall_rules(project_id):
    """Get all firewall rules for a project"""
    return FirewallRule.query.filter_by(project_id=project_id).all()

def add_firewall_rule(project_id, rule_type, value, description=None):
    """Add a new firewall rule to a project"""
    rule = FirewallRule(
        project_id=project_id,
        rule_type=rule_type,
        value=value,
        description=description
    )
    db.session.add(rule)
    db.session.commit()
    return rule

def delete_firewall_rule(rule_id):
    """Delete a firewall rule"""
    rule = FirewallRule.query.get(rule_id)
    if rule:
        db.session.delete(rule)
        db.session.commit()
        return True
    return False

def import_rules_from_json(project_id, json_data):
    """Import firewall rules from JSON data"""
    try:
        data = json.loads(json_data) if isinstance(json_data, str) else json_data
        
        # Import path rules
        for path in data.get('blocked_paths', []):
            add_firewall_rule(project_id, 'path', path, 'Imported from JSON')
        
        # Import method rules
        for method in data.get('blocked_methods', []):
            add_firewall_rule(project_id, 'method', method, 'Imported from JSON')
        
        # Import pattern rules
        for pattern in data.get('path_patterns', []):
            add_firewall_rule(project_id, 'pattern', pattern, 'Imported from JSON')
            
        return True
    except Exception as e:
        print(f"Error importing firewall rules: {e}")
        return False

def export_rules_to_json(project_id):
    """Export firewall rules to JSON format"""
    rules = get_project_firewall_rules(project_id)
    
    result = {
        'blocked_paths': [],
        'blocked_methods': [],
        'path_patterns': []
    }
    
    for rule in rules:
        if rule.rule_type == 'path':
            result['blocked_paths'].append(rule.value)
        elif rule.rule_type == 'method':
            result['blocked_methods'].append(rule.value)
        elif rule.rule_type == 'pattern':
            result['path_patterns'].append(rule.value)
    
    return result

# Helper functions for working with access requests

def get_access_requests(project_id, status=None):
    """Get access requests for a project, optionally filtered by status"""
    query = FirewallAccessRequest.query.filter_by(project_id=project_id)
    if status:
        query = query.filter_by(status=status)
    return query.order_by(FirewallAccessRequest.created_at.desc()).all()

def create_access_request(project_id, ip_address, method, path, rule_id=None, block_reason=None):
    """Create a new access request"""
    request = FirewallAccessRequest(
        project_id=project_id,
        ip_address=ip_address,
        method=method,
        path=path,
        rule_id=rule_id,
        block_reason=block_reason
    )
    db.session.add(request)
    db.session.commit()
    return request

def approve_access_request(request_id, duration_minutes=5):
    """Approve an access request for a limited time"""
    request = FirewallAccessRequest.query.get(request_id)
    if request:
        request.status = "approved"
        request.approved_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=duration_minutes)
        db.session.commit()
        return request
    return None

def reject_access_request(request_id):
    """Reject an access request"""
    request = FirewallAccessRequest.query.get(request_id)
    if request:
        request.status = "rejected"
        request.approved_until = None
        db.session.commit()
        return request
    return None

def check_access_approval(project_id, ip_address, method, path):
    """Check if there's an approved access request for this request"""
    now = datetime.datetime.utcnow()
    request = FirewallAccessRequest.query.filter_by(
        project_id=project_id,
        ip_address=ip_address,
        method=method,
        path=path,
        status="approved"
    ).filter(FirewallAccessRequest.approved_until > now).first()
    
    return request is not None