from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import datetime
from PIL import Image
import os, secrets
from sqlalchemy import UniqueConstraint
db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    full_name = db.Column(db.String(100))
    bio = db.Column(db.Text)
    location = db.Column(db.String(100))
    website = db.Column(db.String(200))
    profile_image = db.Column(db.String(255), default='default.png')  # Make sure this has default
    
    def set_password(self, password):
        """Set password hash"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password against hash"""
        return check_password_hash(self.password_hash, password)
    
    @property
    def avatar_url(self):
        """Get user avatar URL with proper fallback"""
        if not self.profile_image or self.profile_image == '' or self.profile_image is None:
            return 'default.png'
        return self.profile_image
    
    def get_avatar_path(self):
        """Get full path to avatar file"""
        if not self.profile_image or self.profile_image == '' or self.profile_image is None:
            return '/def/default.png'
        
        if self.profile_image == 'default.png':
            return '/def/default.png'
        
        # For custom uploaded images
        if self.profile_image.startswith('uploads/'):
            return f'/static/{self.profile_image}'
        else:
            return f'/static/uploads/{self.profile_image}'
    
    def to_dict(self):
        """Convert user to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name or '',
            'bio': self.bio or '',
            'avatar_url': self.get_avatar_path(),  # Use the full path method
            'location': self.location or '',
            'website': self.website or '',
            'created_at': self.created_at.isoformat() if self.created_at else '',
            'repository_count': 0  # You can implement this later
        }
    
    def __repr__(self):
        return f'<User {self.username}>'
    
class Photo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False, unique=True)
    thumb_filename = db.Column(db.String(255), nullable=True)
    mime_type = db.Column(db.String(64), nullable=False)
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    file_size = db.Column(db.Integer)  # bytes
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    is_public = db.Column(db.Boolean, default=False, nullable=False)
    caption = db.Column(db.String(255), nullable=True)
    user = db.relationship('User', backref=db.backref('photos', lazy='dynamic', cascade='all, delete-orphan'))

    def thumb_url(self):
        return f'uploads/{self.user_id}/{self.thumb_filename}' if self.thumb_filename else None

    def full_url(self):
        return f'uploads/{self.user_id}/{self.stored_filename}'


class Repo(db.Model):
    __tablename__ = "repos"
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    is_private = db.Column(db.Boolean, default=False)
    description = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    default_branch = db.Column(db.String(50), default="main")
    language = db.Column(db.String(50), default="")
    
    # New fields for enhanced functionality
    stars_count = db.Column(db.Integer, default=0)
    forks_count = db.Column(db.Integer, default=0)
    issues_count = db.Column(db.Integer, default=0)
    commits_count = db.Column(db.Integer, default=0)
    size = db.Column(db.Integer, default=0)  # in KB
    
    owner = db.relationship("User", backref=db.backref("repos", lazy="dynamic"))
    
    __table_args__ = (
        UniqueConstraint('owner_id', 'name', name='uq_repo_owner_name'),
    )

    @property
    def full_name(self):
        return f"{self.owner.username}/{self.name}"

    def is_starred_by(self, user):
        if not user or not user.is_authenticated:
            return False
        return RepoStar.query.filter_by(repo_id=self.id, user_id=user.id).first() is not None

    def is_forked_by(self, user):
        if not user or not user.is_authenticated:
            return False
        return RepoFork.query.filter_by(repo_id=self.id, user_id=user.id).first() is not None

class RepoFile(db.Model):
    __tablename__ = "repo_files"
    id = db.Column(db.Integer, primary_key=True)
    repo_id = db.Column(db.Integer, db.ForeignKey("repos.id"), nullable=False, index=True)
    path = db.Column(db.String(512), nullable=False)
    filename = db.Column(db.String(256), nullable=False)
    size = db.Column(db.Integer, default=0)
    content_type = db.Column(db.String(128), default="application/octet-stream")
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    repo = db.relationship("Repo", backref=db.backref("files", lazy="dynamic"))

    __table_args__ = (
        UniqueConstraint('repo_id', 'path', name='uq_repo_file_path'),
    )

class RepoStar(db.Model):
    __tablename__ = "repo_stars"
    id = db.Column(db.Integer, primary_key=True)
    repo_id = db.Column(db.Integer, db.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    repo = db.relationship("Repo", backref=db.backref("stars", lazy="dynamic", cascade="all, delete-orphan"))
    user = db.relationship("User", backref=db.backref("starred_repos", lazy="dynamic", cascade="all, delete-orphan"))
    
    __table_args__ = (
        UniqueConstraint('repo_id', 'user_id', name='uq_repo_star'),
    )

class RepoFork(db.Model):
    __tablename__ = "repo_forks"
    id = db.Column(db.Integer, primary_key=True)
    repo_id = db.Column(db.Integer, db.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False)  # Original repo
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)   # User who forked
    forked_repo_id = db.Column(db.Integer, db.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False)  # The new forked repo
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    original_repo = db.relationship("Repo", foreign_keys=[repo_id], backref=db.backref("forks", lazy="dynamic", cascade="all, delete-orphan"))
    user = db.relationship("User", backref=db.backref("forked_repos", lazy="dynamic", cascade="all, delete-orphan"))
    forked_repo = db.relationship("Repo", foreign_keys=[forked_repo_id])
    
    __table_args__ = (
        UniqueConstraint('repo_id', 'user_id', name='uq_repo_fork'),
    )

class RepoCommit(db.Model):
    __tablename__ = "repo_commits"
    id = db.Column(db.Integer, primary_key=True)
    repo_id = db.Column(db.Integer, db.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    hash = db.Column(db.String(40), nullable=False)  # Git commit hash
    message = db.Column(db.Text, nullable=False)
    author_name = db.Column(db.String(100), nullable=False)
    author_email = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    repo = db.relationship("Repo", backref=db.backref("commits", lazy="dynamic", cascade="all, delete-orphan"))
    user = db.relationship("User", backref=db.backref("commits", lazy="dynamic"))

class RepoIssue(db.Model):
    __tablename__ = "repo_issues"
    id = db.Column(db.Integer, primary_key=True)
    repo_id = db.Column(db.Integer, db.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, default="")
    state = db.Column(db.String(20), default="open")  # open, closed
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    repo = db.relationship("Repo", backref=db.backref("issues", lazy="dynamic", cascade="all, delete-orphan"))
    user = db.relationship("User", backref=db.backref("issues", lazy="dynamic"))


# Add to models.py (after your existing models)

class Agent(db.Model):
    __tablename__ = "agents"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    api_key = db.Column(db.String(255), unique=True, nullable=False)
    status = db.Column(db.String(20), default='offline')  # online, offline
    last_heartbeat = db.Column(db.DateTime)
    system_info = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('agents', lazy='dynamic', cascade='all, delete-orphan'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'status': self.status,
            'last_heartbeat': self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            'system_info': self.system_info,
            'created_at': self.created_at.isoformat()
        }

class Project(db.Model):
    __tablename__ = "projects"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    agent_id = db.Column(db.Integer, db.ForeignKey('agents.id', ondelete='SET NULL'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    path = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    command = db.Column(db.String(500), default='npm run dev')
    port = db.Column(db.Integer)
    status = db.Column(db.String(20), default='stopped')
    pid = db.Column(db.Integer)
    pending_action = db.Column(db.String(20), nullable=True)  # ✅ Already exists
    
    # ✅ ADD THIS LINE:
    tunnel_port = db.Column(db.Integer, nullable=True)  # Port for tunnel server (10000-20000 range)
    
    last_started = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    is_public = db.Column(db.Boolean, default=False)
    subdomain = db.Column(db.String(100), unique=True, nullable=True)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('projects', lazy='dynamic', cascade='all, delete-orphan'))
    agent = db.relationship('Agent', backref=db.backref('projects', lazy='dynamic'), foreign_keys=[agent_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'path': self.path,
            'description': self.description,
            'command': self.command,
            'port': self.port,
            'status': self.status,
            'pid': self.pid,
            'agent_id': self.agent_id,
            'agent_name': self.agent.name if self.agent else None,
            'agent_status': self.agent.status if self.agent else None,
            'is_public': self.is_public,
            'subdomain': self.subdomain,
            'tunnel_port': self.tunnel_port,  # ✅ ADD THIS
            'url': f"https://{self.subdomain}.YOURDOMAIN.com" if self.subdomain else None,
            'last_started': self.last_started.isoformat() if self.last_started else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }




class Command(db.Model):
    __tablename__ = "commands"
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    action = db.Column(db.String(20), nullable=False)  # start, stop, restart
    status = db.Column(db.String(20), default='pending')  # pending, completed, failed
    result = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    agent = db.relationship('Agent', backref=db.backref('commands', lazy='dynamic', cascade='all, delete-orphan'))
    project = db.relationship('Project', backref=db.backref('commands', lazy='dynamic', cascade='all, delete-orphan'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'action': self.action,
            'status': self.status,
            'result': self.result,
            'project': self.project.to_dict() if self.project else None,
            'created_at': self.created_at.isoformat()
        }

class ProjectLog(db.Model):
    __tablename__ = "project_logs"
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    log_type = db.Column(db.String(20))  # stdout, stderr
    content = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    
    project = db.relationship('Project', backref=db.backref('logs', lazy='dynamic', cascade='all, delete-orphan'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.log_type,
            'content': self.content,
            'timestamp': self.timestamp.isoformat()
        }