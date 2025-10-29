
# Certion reverse proxy

A self-hosted alternative to ngrok that allows you to expose local web services to the internet with custom subdomains.

## Overview

Certion is a platform in development aiming to provide security, efficiency, and reliability for developers, this repository contains self-hosted tunneling solution that enables developers to make their local development servers accessible from anywhere. Using a client-server architecture with WebSocket tunnels, it provides secure access to local web applications without complex network configuration or port forwarding.

## Key Features

- **Custom Subdomains**: Assign memorable subdomains to your projects
- **User Authentication**: Secure multi-user system with account management
- **Agent System**: Lightweight client that runs on your development machine
- **Project Management**: Organize and control multiple development projects
- **WebSocket Tunnels**: Efficient and reliable tunneling through firewalls and NATs
- **Process Management**: Start, stop, and monitor your development servers
- **Real-time Logs**: View application logs directly through the dashboard
- **Repository Integration**: Optional Git repository hosting and management

## How It Works

1. **Server Component**: Runs on your publicly accessible server
2. **Agent Component**: Runs on your local development machine
3. **WebSocket Connection**: Establishes a secure tunnel between server and agent
4. **HTTP Proxying**: Routes incoming requests to your local application

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│             │       │             │       │             │
│   Internet  │ HTTPS │  Certion    │  WS   │  Certion    │
│   Clients   ├──────►│   Server    ├──────►│    Agent    │
│             │       │             │       │             │
└─────────────┘       └─────────────┘       └─────────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │             │
                                            │    Local    │
                                            │ Application │
                                            │             │
                                            └─────────────┘
```

## Installation

### Server Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/Certion.git
   cd Certion
   ```

2. Install server dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables:
   ```bash
   export SECRET_KEY="your-secret-key"
   export DOMAIN="your-domain.com"
   export PORT=3000
   ```

4. Initialize the database:
   ```bash
   flask db upgrade
   ```

5. Start the server:
   ```bash
   python app.py
   ```

### Agent Setup

1. Download the agent script from your server:
   ```bash
   https://your-domain.com/agent.py
   ```

2. Install agent dependencies:
   ```bash
   pip install requests psutil aiohttp
   ```

3. Run the agent with your API key:
   ```bash
   python agent.py --server https://your-domain.com --api-key YOUR_API_KEY
   ```

## Usage Guide

### 1. Register and Create an Agent

1. Register a new account at `https://your-domain.com/register`
2. Log in with your credentials
3. Navigate to the Agents section in the dashboard
4. Click "Create New Agent" and provide a name
5. Copy the API key (shown only once) for agent setup
6. Run the agent script on your development machine with the API key

### 2. Create a Project

1. Navigate to the Projects section in the dashboard
2. Click "Create New Project" and fill in the details:
   - Name: Project name
   - Path: Local path on the agent machine
   - Command: Command to start the project (e.g., `npm run dev`)
   - Port: Local port the project runs on
   - Agent: Select the agent to run this project

### 3. Start Your Tunnel

1. Use the dashboard to start your project
2. The agent will execute the command and start your local server
3. A WebSocket tunnel will be established automatically
4. Access your application via `https://projectname-username.your-domain.com`

### 4. Manage Your Projects

- Start, stop, and restart projects from the dashboard
- Share your public URL with others

## Security Considerations

- Always use HTTPS in production environments
- Keep your API keys secure and never share them
- Regularly update the server and agent components
- Consider implementing IP restrictions for sensitive projects
- Enable authentication for projects that need it

## Advanced Configuration

### Custom Domain Setup

To use custom domains with your tunnels:

1. Configure your DNS provider to point the domain to your server
2. Update your server's NGINX/Apache configuration to handle the domain
3. Add SSL certificates for your custom domain
# Firewall Protection

## Advanced Security for Your Exposed Services

Certion includes a powerful firewall system that provides fine-grained control over who can access your exposed services and what they can do. This feature is essential for protecting development environments that might contain sensitive information or functionality.

### Key Firewall Features

- **Custom Rule Creation**: Define rules based on HTTP methods and URL paths
- **Access Request System**: Review and approve temporary access to blocked resources
- **Real-time Monitoring**: Track blocked requests and access attempts
- **Temporary Access Grants**: Allow time-limited access for legitimate needs
- **Import/Export**: Easily transfer firewall configurations between projects

### How It Works

1. **Define Rules**: Create rules to protect sensitive endpoints (e.g., block POST requests to `/admin/*`)
2. **Automatic Blocking**: The firewall automatically blocks requests matching your rules
3. **Access Requests**: When blocked, users can submit access requests with justification
4. **Review Process**: Project owners can review, approve, or reject access requests
5. **Temporary Access**: Approved requests grant time-limited access (configurable duration)

### Firewall Dashboard

The dedicated firewall dashboard provides:

- Complete overview of all firewall rules
- List of pending and approved access requests
- Tools to quickly approve or reject access
- Configuration options for default behavior
- Statistics on blocked requests and access patterns

### Example Use Cases

- **Protect Admin Interfaces**: Block access to administrative endpoints
- **Secure API Endpoints**: Control who can make API calls
- **Prevent Data Modification**: Allow read access but block write operations
- **Staging Environment Protection**: Share view access while preventing changes
- **Demo Environment Security**: Allow specific features while blocking others

### Implementation

The firewall integrates seamlessly with Certion's tunneling system, evaluating each request before it reaches your local application. This ensures that unauthorized requests are blocked at the edge, never reaching your development environment.

```
┌─────────────┐       ┌───────────────────────────────┐       ┌─────────────┐
│             │       │           Certion             │       │             │
│   Internet  │ HTTPS │ ┌─────────┐      ┌─────────┐ │  WS   │  Certion    │
│   Clients   ├──────►│ │Firewall ├─────►│ Tunnel  ├─┼──────►│  Agent      │
│             │       │ └─────────┘      └─────────┘ │       │             │
└─────────────┘       └───────────────────────────────┘       └─────────────┘
```

### Getting Started with Firewall Protection

1. Navigate to your project in the Certion dashboard
2. Click on the "Firewall" tab
3. Add your first rule by specifying:
   - HTTP method (GET, POST, PUT, DELETE, etc.)
   - URL path pattern (exact match or wildcard patterns)
   - Description (to remember the purpose of the rule)
4. Save your configuration and test
5. Monitor the "Access Requests" section for any blocked legitimate access

The firewall system makes Certion suitable for a wide range of development scenarios, from personal projects to team collaborations, ensuring that your exposed services remain secure while still being accessible to authorized users.
### High Availability Setup

For production use with high availability:

1. Set up multiple server instances behind a load balancer
2. Configure a shared database for session and tunnel information
3. Implement health checks and automatic failover

## Troubleshooting

### Common Issues

1. **Agent Connection Problems**
   - Verify the server URL is correct and accessible
   - Check that the API key is valid
   - Ensure there are no firewall restrictions blocking WebSocket connections

2. **Tunnel Not Working**
   - Verify the local port is correct and the application is running
   - Check server logs for connection issues
   - Ensure the subdomain is properly configured

3. **Project Start Failures**
   - Verify the project path exists on the agent machine
   - Check that the start command is correct
   - Review logs for specific error messages

## System Requirements

### Server
- Python 3.7+
- Linux/macOS/Windows server with public IP address
- 1GB+ RAM recommended
- Domain name with DNS configuration

### Agent
- Python 3.7+
- Windows/macOS/Linux
- Stable internet connection

## License

```Copyright (c) 2025 v7ren
Personal Use License

Permission is hereby granted to any person obtaining a copy of this software 
to use it for personal, non-commercial purposes only, subject to the following 
conditions:

PERMITTED:
- Private use and testing
- Personal experimentation
- Educational purposes

NOT PERMITTED:
- Commercial use
- Public distribution or redistribution
- Publishing modified versions
- Incorporating into other projects (public or commercial)
- Sublicensing or selling

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

All rights reserved.
```
## Acknowledgements

- Flask for the web framework
- aiohttp for WebSocket and HTTP capabilities
- React for the frontend interface
- SQLAlchemy for database ORM

