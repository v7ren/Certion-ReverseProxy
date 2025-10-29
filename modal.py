# modal.py
from flask import Flask
import datetime
from models import db
from firewall_models import FirewallRule
import os

# Get the path to the database file
INSTANCE_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
DATABASE_PATH = os.path.join(INSTANCE_FOLDER, 'app.db')

# Create a minimal Flask app
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{DATABASE_PATH}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize the database with the app
db.init_app(app)

# Use the application context
with app.app_context():
    # Create a new firewall rule
    rule = FirewallRule(
        project_id=1,  # Your project ID
        rule_type='path',
        value='/admin',
        description='Block admin access',
        created_at=datetime.datetime.now(datetime.UTC)  # Use timezone-aware datetime
    )

    # Add and commit to database
    db.session.add(rule)
    db.session.commit()
    
    print("Firewall rule added successfully!")
    
    # Verify the rule was added
    rules = FirewallRule.query.filter_by(project_id=1).all()
    print(f"Found {len(rules)} firewall rules for project 1:")
    for r in rules:
        print(f"  - ID: {r.id}, Type: {r.rule_type}, Value: {r.value}")