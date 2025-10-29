import datetime
from models import db
from firewall_models import FirewallAccessRequest

def get_access_requests(project_id, status=None):
    """Get access requests for a project, optionally filtered by status"""
    query = FirewallAccessRequest.query.filter_by(project_id=project_id)
    if status:
        query = query.filter_by(status=status)
    return query.order_by(FirewallAccessRequest.created_at.desc()).all()

def create_access_request(project_id, ip_address, method, path, rule_id=None, block_reason=None, db_session=None):
    """
    Create a new access request
    
    Args:
        project_id: Project ID
        ip_address: Client IP address
        method: HTTP method
        path: Request path
        rule_id: Optional rule ID that triggered the block
        block_reason: Optional reason for blocking
        db_session: Optional SQLAlchemy session to use instead of Flask-SQLAlchemy
    """
    if db_session:
        # Use the provided SQLAlchemy session directly
        from firewall_models import FirewallAccessRequest as DirectFirewallAccessRequest
        request = DirectFirewallAccessRequest(
            project_id=project_id,
            ip_address=ip_address,
            method=method,
            path=path,
            rule_id=rule_id,
            block_reason=block_reason,
            status="pending"
        )
        db_session.add(request)
        db_session.commit()
        return request
    else:
        # Use Flask-SQLAlchemy when in a Flask context
        request = FirewallAccessRequest(
            project_id=project_id,
            ip_address=ip_address,
            method=method,
            path=path,
            rule_id=rule_id,
            block_reason=block_reason,
            status="pending"
        )
        db.session.add(request)
        db.session.commit()
        return request

def approve_access_request(request_id, duration_minutes=5):
    """Approve an access request for a specified duration"""
    request = FirewallAccessRequest.query.get(request_id)
    if request:
        request.status = "approved"
        request.approved_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=duration_minutes)
        db.session.commit()
        return True
    return False

def reject_access_request(request_id):
    """Reject an access request"""
    request = FirewallAccessRequest.query.get(request_id)
    if request:
        request.status = "rejected"
        db.session.commit()
        return True
    return False

def revoke_access_request(request_id=None, project_id=None, ip_address=None, db_session=None):
    """
    Revoke an approved access request
    
    Args:
        request_id: Optional specific request ID to revoke
        project_id: Optional project ID to revoke all approved requests for
        ip_address: Optional IP address to revoke all approved requests for
        db_session: Optional SQLAlchemy session to use instead of Flask-SQLAlchemy
        
    Returns:
        Tuple of (success, count) where count is the number of revoked requests
    """
    if not any([request_id, project_id, ip_address]):
        return False, 0  # Must provide at least one filter
    
    try:
        if db_session:
            # Use the provided SQLAlchemy session directly
            from firewall_models import FirewallAccessRequest as DirectFirewallAccessRequest
            query = db_session.query(DirectFirewallAccessRequest).filter_by(status="approved")
            
            if request_id:
                query = query.filter_by(id=request_id)
            if project_id:
                query = query.filter_by(project_id=project_id)
            if ip_address:
                query = query.filter_by(ip_address=ip_address)
                
            requests = query.all()
            count = len(requests)
            
            for request in requests:
                request.status = "revoked"
                request.approved_until = datetime.datetime.utcnow()  # Set to current time (expired)
                
            db_session.commit()
            return True, count
        else:
            # Use Flask-SQLAlchemy when in a Flask context
            query = FirewallAccessRequest.query.filter_by(status="approved")
            
            if request_id:
                query = query.filter_by(id=request_id)
            if project_id:
                query = query.filter_by(project_id=project_id)
            if ip_address:
                query = query.filter_by(ip_address=ip_address)
                
            requests = query.all()
            count = len(requests)
            
            for request in requests:
                request.status = "revoked"
                request.approved_until = datetime.datetime.utcnow()  # Set to current time (expired)
                
            db.session.commit()
            return True, count
    except Exception as e:
        import logging
        logging.error(f"Error revoking access requests: {e}")
        return False, 0

def revoke_all_approved_requests(project_id, db_session=None):
    """
    Revoke all approved access requests for a project
    
    Args:
        project_id: Project ID
        db_session: Optional SQLAlchemy session to use instead of Flask-SQLAlchemy
        
    Returns:
        Tuple of (success, count) where count is the number of revoked requests
    """
    return revoke_access_request(project_id=project_id, db_session=db_session)

def is_ip_temporarily_approved(project_id, ip_address, method, path, db_session=None):
    """
    Check if an IP is temporarily approved for a specific path
    
    Args:
        project_id: Project ID
        ip_address: Client IP address
        method: HTTP method
        path: Request path
        db_session: Optional SQLAlchemy session to use instead of Flask-SQLAlchemy
    """
    now = datetime.datetime.utcnow()
    
    try:
        if db_session:
            # Use the provided SQLAlchemy session directly
            from firewall_models import FirewallAccessRequest as DirectFirewallAccessRequest
            request = db_session.query(DirectFirewallAccessRequest).filter_by(
                project_id=project_id,
                ip_address=ip_address,
                method=method,
                path=path,
                status="approved"
            ).filter(DirectFirewallAccessRequest.approved_until > now).first()
        else:
            # Use Flask-SQLAlchemy when in a Flask context
            request = FirewallAccessRequest.query.filter_by(
                project_id=project_id,
                ip_address=ip_address,
                method=method,
                path=path,
                status="approved"
            ).filter(FirewallAccessRequest.approved_until > now).first()
        
        return request is not None
    except Exception as e:
        # Log the error but don't block the request
        import logging
        logging.error(f"Error checking temporary approval: {e}")
        return False