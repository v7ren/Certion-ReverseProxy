from functools import wraps
from flask import make_response, request

def disable_csp(app):
    """
    Middleware to disable Content Security Policy headers
    and add headers that allow all content.
    """
    @app.after_request
    def add_security_headers(response):
        # Remove any existing CSP headers
        headers_to_remove = [
            'Content-Security-Policy',
            'Content-Security-Policy-Report-Only',
            'X-Content-Security-Policy',
            'X-WebKit-CSP'
        ]
        
        for header in headers_to_remove:
            if header in response.headers:
                del response.headers[header]
        
        # Add permissive CSP header
        response.headers['Content-Security-Policy'] = "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';"
        
        return response
    
    return app