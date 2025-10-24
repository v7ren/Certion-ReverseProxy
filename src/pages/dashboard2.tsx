import { useState, useEffect } from 'react';
import Header from './header';
import Nav from './nav';
import { 
  Shield, FolderOpen, Plus, User,
  Code, Activity, Play, Square, RotateCw, Trash2,
  Edit, Eye, Terminal, Cpu, HardDrive, AlertCircle, Clock, X
} from 'lucide-react';

// Updated User type to match auth.py response
type User = {
  username: string;
  email: string;
  avatar_url?: string;
};

type Project = {
  id: number;
  name: string;
  path: string;
  description: string;
  port: number | null;
  command: string;
  status: 'running' | 'stopped';
  pid: number | null;
  last_started: string | null;
  created_at: string;
  updated_at: string;
  agent_id: number;
  agent?: Agent;
};

type ProjectStatus = {
  running: boolean;
  pid: number | null;
  cpu_usage: number;
  memory_usage: number;
  port: number | null;
  last_started: string | null;
};

type ToastType = 'success' | 'error' | 'warning' | 'info';

type Agent = {
  id: number;
  name: string;
  status: 'online' | 'offline';
  last_heartbeat: string | null;
  system_info: any;
  created_at: string;
};

// ==================== AUTH SERVICE ====================
export const authService = {
  async logout() {
    try {
      await fetch('/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  },

  async checkAuth() {
    try {
      const res = await fetch('/api/auth/check', {
        method: 'GET',
        credentials: 'include',
      });
      const data = await res.json();
      return data.authenticated || false;
    } catch {
      return false;
    }
  }
};

// ==================== AGENTS SERVICE ====================
const agentsService = {
  async getAll(): Promise<Agent[]> {
    const res = await fetch('/api/agents', {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.agents;
  },

  async create(name: string): Promise<{ agent: Agent; api_key: string }> {
    const res = await fetch('/api/agents', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return { agent: data.agent, api_key: data.api_key };
  },

  async delete(id: number): Promise<void> {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },
};

// ==================== PROJECTS SERVICE ====================
const projectsService = {
  async getAll(): Promise<Project[]> {
    const res = await fetch('/api/projects', {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.projects;
  },

  async getOne(id: number): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.project;
  },

  async create(projectData: {
    name: string;
    path: string;
    description?: string;
    port?: number | null;
    command?: string;
    agent_id: number;
  }): Promise<Project> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...projectData,
        port: projectData.port || null
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.project;
  },

  async update(id: number, projectData: Partial<Project>): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.project;
  },

  async delete(id: number): Promise<void> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  },

  async start(id: number): Promise<Project> {
    const res = await fetch(`/api/projects/${id}/start`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.project;
  },

  async stop(id: number): Promise<Project> {
    const res = await fetch(`/api/projects/${id}/stop`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.project;
  },

  async restart(id: number): Promise<Project> {
    const res = await fetch(`/api/projects/${id}/restart`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.project;
  },

  async getStatus(id: number): Promise<ProjectStatus> {
    const res = await fetch(`/api/projects/${id}/status`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.status;
  },

  async getLogs(id: number): Promise<{ stdout: string[]; stderr: string[] }> {
    const res = await fetch(`/api/projects/${id}/logs`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.logs;
  },
};

const CertionDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  const [user, setUser] = useState<User | null>(null);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [projectStatuses, setProjectStatuses] = useState<Map<number, ProjectStatus>>(new Map());

  // Agents state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [showAgentApiKeyModal, setShowAgentApiKeyModal] = useState(false);
  const [showDeleteAgentModal, setShowDeleteAgentModal] = useState(false);
  const [newAgentApiKey, setNewAgentApiKey] = useState('');
  const [agentFormData, setAgentFormData] = useState({ name: '' });

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: ToastType }>({
    show: false,
    message: '',
    type: 'info',
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    description: '',
    port: '',
    command: 'npm run dev',
    agent_id: '',
  });

  // Fetch user info
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then(data => {
        console.log('User data received:', data);
        setUser(data.user);
      })
      .catch((error) => {
        console.error('Failed to fetch user:', error);
        setUser(null);
      });
  }, []);

  // Fetch projects
  useEffect(() => {
    if (activeTab === 'projects') {
      loadProjects();
    }
  }, [activeTab]);

  // Fetch agents
  useEffect(() => {
    if (activeTab === 'agents') {
      loadAgents();
    }
  }, [activeTab]);

  // Load agents on mount (needed for project creation)
  useEffect(() => {
    loadAgents();
  }, []);

  // Auto-refresh project statuses
  useEffect(() => {
    if (activeTab === 'projects' && projects.length > 0) {
      const interval = setInterval(() => {
        refreshProjectStatuses();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [activeTab, projects]);

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const data = await projectsService.getAll();
      setProjects(data);
      await refreshProjectStatuses();
    } catch (error) {
      showToast('Failed to load projects', 'error');
      console.error(error);
    } finally {
      setProjectsLoading(false);
    }
  };

  const refreshProjectStatuses = async () => {
    const statusMap = new Map<number, ProjectStatus>();
    await Promise.all(
      projects.map(async (project) => {
        try {
          const status = await projectsService.getStatus(project.id);
          statusMap.set(project.id, status);
        } catch (error) {
          console.error(`Failed to get status for project ${project.id}`, error);
        }
      })
    );
    setProjectStatuses(statusMap);
  };

  // ==================== AGENT HANDLERS ====================
  const loadAgents = async () => {
    setAgentsLoading(true);
    try {
      const data = await agentsService.getAll();
      setAgents(data);
    } catch (error) {
      showToast('Failed to load agents', 'error');
      console.error(error);
    } finally {
      setAgentsLoading(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentFormData.name.trim()) {
      showToast('Agent name is required', 'error');
      return;
    }
    
    try {
      const result = await agentsService.create(agentFormData.name);
      showToast('Agent created successfully!', 'success');
      setShowCreateAgentModal(false);
      setNewAgentApiKey(result.api_key);
      setShowAgentApiKeyModal(true);
      setAgentFormData({ name: '' });
      loadAgents();
    } catch (error: any) {
      showToast(error.message || 'Failed to create agent', 'error');
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;
    try {
      await agentsService.delete(selectedAgent.id);
      showToast('Agent deleted successfully', 'success');
      setShowDeleteAgentModal(false);
      setSelectedAgent(null);
      loadAgents();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete agent', 'error');
    }
  };

  const openDeleteAgentModal = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowDeleteAgentModal(true);
  };

  const copyApiKeyToClipboard = () => {
    navigator.clipboard.writeText(newAgentApiKey);
    showToast('API key copied to clipboard!', 'success');
  };

  const downloadAgentScript = () => {
    const scriptContent = `# Download and run the agent
# 1. Install dependencies:
pip install requests psutil

# 2. Download agent.py from:
${window.location.origin}/agent.py

# 3. Run the agent:
python agent.py ${window.location.origin} ${newAgentApiKey}
`;
    
    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'setup-agent.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==================== PROJECT HANDLERS ====================
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agent_id) {
      showToast('Please select an agent', 'error');
      return;
    }
    
    try {
      await projectsService.create({
        name: formData.name,
        path: formData.path,
        description: formData.description,
        port: formData.port ? parseInt(formData.port) : null,
        command: formData.command,
        agent_id: parseInt(formData.agent_id),
      });
      showToast('Project created successfully', 'success');
      setShowCreateModal(false);
      resetForm();
      loadProjects();
    } catch (error: any) {
      showToast(error.message || 'Failed to create project', 'error');
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      await projectsService.update(selectedProject.id, {
        name: formData.name,
        path: formData.path,
        description: formData.description,
        port: formData.port ? parseInt(formData.port) : null,
        command: formData.command,
      });
      showToast('Project updated successfully', 'success');
      setShowEditModal(false);
      setSelectedProject(null);
      resetForm();
      loadProjects();
    } catch (error: any) {
      showToast(error.message || 'Failed to update project', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    try {
      await projectsService.delete(selectedProject.id);
      showToast('Project deleted successfully', 'success');
      setShowDeleteModal(false);
      setSelectedProject(null);
      loadProjects();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete project', 'error');
    }
  };

  const handleStartProject = async (project: Project) => {
    try {
      await projectsService.start(project.id);
      showToast(`Starting ${project.name}...`, 'info');
      setTimeout(() => loadProjects(), 2000);
    } catch (error: any) {
      showToast(error.message || 'Failed to start project', 'error');
    }
  };

  const handleStopProject = async (project: Project) => {
    try {
      await projectsService.stop(project.id);
      showToast(`Stopping ${project.name}...`, 'info');
      setTimeout(() => loadProjects(), 2000);
    } catch (error: any) {
      showToast(error.message || 'Failed to stop project', 'error');
    }
  };

  const handleRestartProject = async (project: Project) => {
    try {
      await projectsService.restart(project.id);
      showToast(`Restarting ${project.name}...`, 'info');
      setTimeout(() => loadProjects(), 2000);
    } catch (error: any) {
      showToast(error.message || 'Failed to restart project', 'error');
    }
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      path: project.path,
      description: project.description || '',
      port: project.port?.toString() || '',
      command: project.command || 'npm run dev',
      agent_id: project.agent_id?.toString() || '',
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (project: Project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
  };

  const openStatusModal = (project: Project) => {
    setSelectedProject(project);
    setShowStatusModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      path: '',
      description: '',
      port: '',
      command: 'npm run dev',
      agent_id: '',
    });
  };

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 3000);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/login';
    }
  };

  return (
    <>
      <style>{`
        .dashboard-container {
            min-height: 100vh;
            background-color: white;
        }

        .main-content {
            min-height: 100vh;
            padding-top: 64px;
            transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.6, 1);
        }

        @media (min-width: 768px) {
            .main-content {
            margin-left: 256px;
            }
        }

        @media (max-width: 767px) {
            .main-content {
            margin-left: 0 !important;
            }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from { transform: translateY(-10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .modal-overlay {
            animation: fadeIn 0.2s ease;
        }

        .modal-content {
            animation: slideIn 0.3s ease;
        }

        .project-card {
          transition: all 0.3s ease;
        }

        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }
        `}</style>
      <div className="dashboard-container">
        <Header 
          user={user} 
          onLogout={handleLogout}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          showSidebarToggle={true}
        />

        <Nav
          sidebarOpen={sidebarOpen}
          activeTab={activeTab}
          user={user}
          projectsCount={projects.length}
          agents={agents}
          onClose={() => setSidebarOpen(false)}
          onTabClick={(tab) => setActiveTab(tab)}
          onLogout={handleLogout}
        />

        {/* Main Content */}
        <main className={`main-content ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
          {/* Toast Notification */}
          {toast.show && (
            <div className="fixed top-20 right-8 z-50">
              <div className={`px-6 py-4 border-l-4 shadow-lg ${
                toast.type === 'success' ? 'bg-white border-gray-900 text-gray-900' :
                toast.type === 'error' ? 'bg-white border-gray-900 text-gray-900' :
                toast.type === 'warning' ? 'bg-white border-gray-900 text-gray-900' :
                'bg-white border-gray-900 text-gray-900'
              }`}>
                <div className="flex items-center gap-3">
                  {toast.type === 'success' && <Shield className="w-5 h-5" />}
                  {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
                  {toast.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                  {toast.type === 'info' && <Activity className="w-5 h-5" />}
                  <span className="font-light tracking-wider">{toast.message}</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-8 md:p-12">
            {/* ==================== DASHBOARD TAB ==================== */}
            {activeTab === 'dashboard' && (
              <>
                {/* Header Section */}
                <div className="mb-16">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                    <div>
                      <p className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Welcome Back{user ? `, ${user.username.split(' ')[0]}` : ''}
                      </p>
                      <h2 className="text-4xl font-light mb-4 tracking-tight">Dashboard Overview</h2>
                      <p className="text-lg font-light text-gray-700 max-w-md">
                        Monitor your projects, agents, and system metrics.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200 mb-16">
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Total Projects
                      </h3>
                      <p className="text-4xl font-light">{projects.length}</p>
                    </div>
                    <p className="text-sm font-light text-gray-500">All registered projects</p>
                  </div>
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Running
                      </h3>
                      <p className="text-4xl font-light">
                        {projects.filter(p => p.status === 'running').length}
                      </p>
                    </div>
                    <p className="text-sm font-light text-gray-500">Active processes</p>
                  </div>
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Total Agents
                      </h3>
                      <p className="text-4xl font-light">{agents.length}</p>
                    </div>
                    <p className="text-sm font-light text-gray-500">Registered agents</p>
                  </div>
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Online Agents
                      </h3>
                      <p className="text-4xl font-light">
                        {agents.filter(a => a.status === 'online').length}
                      </p>
                    </div>
                    <p className="text-sm font-light text-gray-500">Active connections</p>
                  </div>
                </div>

                {/* Recent Projects */}
                <div className="border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 p-8">
                    <h3 className="text-2xl font-light tracking-wider">Recent Activity</h3>
                  </div>
                  <div className="p-8">
                    {projects.length === 0 ? (
                      <p className="text-gray-500 text-center py-8 font-light">No projects yet. Create your first one!</p>
                    ) : (
                      <div className="flex flex-col gap-8">
                        {projects.slice(0, 5).map((project, index) => {
                          const status = projectStatuses.get(project.id);
                          return (
                            <div key={index} className="flex items-start gap-6 pb-8 border-b border-gray-100 last:border-b-0 last:pb-0">
                              <div className="flex-shrink-0 mt-2">
                                {status?.running ? <Activity className="w-5 h-5" /> : <Code className="w-5 h-5" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-medium tracking-wider">{project.name}</h4>
                                  <span className="text-xs tracking-widest uppercase text-gray-900 font-medium">
                                    {status?.running ? 'RUNNING' : 'STOPPED'}
                                  </span>
                                </div>
                                <p className="text-gray-700 font-light mb-3">
                                  {project.description || 'No description available'}
                                </p>
                                <p className="text-xs font-light text-gray-500 tracking-wider flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  {project.last_started 
                                    ? `Last started ${new Date(project.last_started).toLocaleString()}`
                                    : 'Never started'
                                  }
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ==================== PROJECTS TAB ==================== */}
            {activeTab === 'projects' && (
              <>
                {/* Header Section */}
                <div className="mb-16">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                    <div>
                      <p className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Project Management
                      </p>
                      <h2 className="text-4xl font-light mb-4 tracking-tight">My Projects</h2>
                      <p className="text-lg font-light text-gray-700 max-w-md">
                        Manage, monitor, and deploy your development projects.
                      </p>
                    </div>
                    <div className="flex flex-col gap-4 mt-8 lg:mt-0">
                      <button 
                        onClick={() => setShowCreateModal(true)}
                        className="bg-gray-900 text-white py-4 px-8 hover:bg-gray-800 font-light tracking-wider flex items-center gap-2 border-none cursor-pointer transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>NEW PROJECT</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200 mb-16">
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Total Projects
                      </h3>
                      <p className="text-4xl font-light">{projects.length}</p>
                    </div>
                    <p className="text-sm font-light text-gray-500">All registered projects</p>
                  </div>
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Running
                      </h3>
                      <p className="text-4xl font-light">
                        {Array.from(projectStatuses.values()).filter(status => status.running).length}
                      </p>
                    </div>
                    <p className="text-sm font-light text-gray-500">Active processes</p>
                  </div>
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Stopped
                      </h3>
                      <p className="text-4xl font-light">
                        {projects.length - Array.from(projectStatuses.values()).filter(status => status.running).length}
                      </p>
                    </div>
                    <p className="text-sm font-light text-gray-500">Inactive projects</p>
                  </div>
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Total Ports
                      </h3>
                      <p className="text-4xl font-light">
                        {projects.filter(p => p.port).length}
                      </p>
                    </div>
                    <p className="text-sm font-light text-gray-500">Configured ports</p>
                  </div>
                </div>

                {/* Projects Grid */}
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-500 font-light tracking-wider">Loading projects...</p>
                    </div>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="border border-gray-200 bg-white p-16 text-center">
                    <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-2xl font-light mb-2">No Projects Yet</h3>
                    <p className="text-gray-500 font-light mb-6">
                      Create your first project to get started
                    </p>
                    <button 
                      onClick={() => setShowCreateModal(true)}
                      className="bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider inline-flex items-center gap-2 border-none cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>CREATE PROJECT</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                    {projects.map((project) => {
                      const status = projectStatuses.get(project.id);
                      const isRunning = status?.running || false;

                      return (
                        <div 
                          key={project.id} 
                          className="border border-gray-200 bg-white project-card"
                        >
                          {/* Project Header */}
                          <div className="border-b border-gray-200 p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-xl font-medium tracking-wider">{project.name}</h3>
                                  <span className={`text-xs px-2 py-1 font-light tracking-widest uppercase ${
                                    isRunning 
                                      ? 'bg-gray-900 text-white' 
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {isRunning ? 'RUNNING' : 'STOPPED'}
                                  </span>
                                </div>
                                <p className="text-sm font-light text-gray-500 line-clamp-2">
                                  {project.description || 'No description'}
                                </p>
                              </div>
                            </div>

                            {/* Project Info */}
                            <div className="space-y-2 text-sm font-light text-gray-600">
                              <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4" />
                                <span className="truncate">{project.command}</span>
                              </div>
                              {project.port ? (
                                <div className="flex items-center gap-2">
                                  <Activity className="w-4 h-4" />
                                  <span>Port: {project.port}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Activity className="w-4 h-4" />
                                  <span className="text-gray-400">Port: App default</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <FolderOpen className="w-4 h-4" />
                                <span className="truncate text-xs">{project.path}</span>
                              </div>
                              {project.agent && (
                                <div className="flex items-center gap-2">
                                  <Cpu className="w-4 h-4" />
                                  <span>{project.agent.name}</span>
                                  <span className={`w-2 h-2 rounded-full ${
                                    project.agent.status === 'online' ? 'bg-gray-900' : 'bg-gray-400'
                                  }`}></span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Status Info */}
                          {isRunning && status && (
                            <div className="border-b border-gray-200 p-6 bg-gray-50">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                                    <Cpu className="w-4 h-4" />
                                    <span className="text-xs font-light tracking-widest uppercase">CPU</span>
                                  </div>
                                  <p className="text-lg font-light">{status.cpu_usage.toFixed(1)}%</p>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                                    <HardDrive className="w-4 h-4" />
                                    <span className="text-xs font-light tracking-widest uppercase">Memory</span>
                                  </div>
                                  <p className="text-lg font-light">{status.memory_usage.toFixed(0)} MB</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="p-6">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              {isRunning ? (
                                <>
                                  <button
                                    onClick={() => handleStopProject(project)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                                  >
                                    <Square className="w-4 h-4" />
                                    <span>STOP</span>
                                  </button>
                                  <button
                                    onClick={() => handleRestartProject(project)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                                  >
                                    <RotateCw className="w-4 h-4" />
                                    <span>RESTART</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleStartProject(project)}
                                  className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                                  disabled={project.agent?.status !== 'online'}
                                >
                                  <Play className="w-4 h-4" />
                                  <span>START</span>
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => openStatusModal(project)}
                                className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-light text-sm tracking-wider transition-colors cursor-pointer"
                                title="View Status"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(project)}
                                className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-light text-sm tracking-wider transition-colors cursor-pointer"
                                title="Edit Project"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal(project)}
                                className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-light text-sm tracking-wider transition-colors cursor-pointer"
                                title="Delete Project"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
                            <div className="flex items-center justify-between text-xs font-light text-gray-500">
                              <span>PID: {status?.pid || 'N/A'}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {project.last_started 
                                  ? new Date(project.last_started).toLocaleString()
                                  : 'Never started'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ==================== AGENTS TAB ==================== */}
            {activeTab === 'agents' && (
              <>
                {/* Header Section */}
                <div className="mb-16">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                    <div>
                      <p className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Agent Management
                      </p>
                      <h2 className="text-4xl font-light mb-4 tracking-tight">All Agents</h2>
                      <p className="text-lg font-light text-gray-700 max-w-md">
                        Manage your remote agents that run your projects.
                      </p>
                    </div>
                    <div className="flex flex-col gap-4 mt-8 lg:mt-0">
                      <button 
                        onClick={() => setShowCreateAgentModal(true)}
                        className="bg-gray-900 text-white py-4 px-8 hover:bg-gray-800 font-light tracking-wider flex items-center gap-2 border-none cursor-pointer transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>NEW AGENT</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 mb-16">
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Total Agents
                      </h3>
                      <p className="text-4xl font-light">{agents.length}</p>
                    </div>
                    <p className="text-sm font-light text-gray-500">All registered agents</p>
                  </div>
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Online
                      </h3>
                      <p className="text-4xl font-light">
                        {agents.filter(a => a.status === 'online').length}
                      </p>
                    </div>
                    <p className="text-sm font-light text-gray-500">Active connections</p>
                  </div>
                  <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                        Offline
                      </h3>
                      <p className="text-4xl font-light">
                        {agents.filter(a => a.status === 'offline').length}
                      </p>
                    </div>
                    <p className="text-sm font-light text-gray-500">Inactive agents</p>
                  </div>
                </div>

                {/* Agents Grid */}
                {agentsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-500 font-light tracking-wider">Loading agents...</p>
                    </div>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="border border-gray-200 bg-white p-16 text-center">
                    <Cpu className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-2xl font-light mb-2">No Agents Yet</h3>
                    <p className="text-gray-500 font-light mb-6">
                      Create your first agent to start managing projects remotely
                    </p>
                    <button 
                      onClick={() => setShowCreateAgentModal(true)}
                      className="bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider inline-flex items-center gap-2 border-none cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>CREATE AGENT</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                    {agents.map((agent) => (
                      <div 
                        key={agent.id} 
                        className="border border-gray-200 bg-white project-card"
                      >
                        {/* Agent Header */}
                        <div className="border-b border-gray-200 p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-medium tracking-wider">{agent.name}</h3>
                                <span className={`text-xs px-2 py-1 font-light tracking-widest uppercase ${
                                  agent.status === 'online' 
                                    ? 'bg-gray-900 text-white' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {agent.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Agent Info */}
                          {agent.system_info && (
                            <div className="space-y-2 text-sm font-light text-gray-600">
                              <div className="flex items-center gap-2">
                                <HardDrive className="w-4 h-4" />
                                <span>{agent.system_info.platform || 'Unknown OS'}</span>
                              </div>
                              {agent.system_info.cpu_count && (
                                <div className="flex items-center gap-2">
                                  <Cpu className="w-4 h-4" />
                                  <span>{agent.system_info.cpu_count} CPU cores</span>
                                </div>
                              )}
                              {agent.system_info.memory_total && (
                                <div className="flex items-center gap-2">
                                  <Activity className="w-4 h-4" />
                                  <span>{(agent.system_info.memory_total / 1024 / 1024 / 1024).toFixed(1)} GB RAM</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Agent Details */}
                        <div className="p-6 bg-gray-50">
                          <div className="space-y-2 text-sm font-light text-gray-600">
                            {agent.last_heartbeat && (
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs">
                                  Last seen: {new Date(agent.last_heartbeat).toLocaleString()}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              <span className="text-xs">
                                Created: {new Date(agent.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="border-t border-gray-200 p-6">
                          <button
                            onClick={() => openDeleteAgentModal(agent)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>DELETE AGENT</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Other tabs placeholder */}
            {!['dashboard', 'projects', 'agents'].includes(activeTab) && (
              <div className="border border-gray-200 bg-white p-16 text-center">
                <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-2xl font-light mb-2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3>
                <p className="text-gray-500 font-light">
                  This section is coming soon
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ==================== CREATE PROJECT MODAL ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-2xl border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Create New Project</h3>
                <button 
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateProject} className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                    placeholder="my-awesome-project"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Agent *
                  </label>
                  <select
                    value={formData.agent_id}
                    onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                    required
                  >
                    <option value="">Select an agent</option>
                    {agents
                      .filter(agent => agent.status === 'online')
                      .map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} (Online)
                        </option>
                      ))}
                    {agents
                      .filter(agent => agent.status === 'offline')
                      .map(agent => (
                        <option key={agent.id} value={agent.id} disabled>
                          {agent.name} (Offline)
                        </option>
                      ))}
                  </select>
                  {agents.length === 0 && (
                    <p className="text-sm text-gray-600 mt-1 font-light">
                      ⚠️ No agents available. Create one first!
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Project Path *
                  </label>
                  <input
                    type="text"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                    placeholder="/path/to/project"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                    placeholder="Project description..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                      Port (Optional)
                    </label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                      placeholder="Leave empty for app default"
                      min="1"
                      max="65535"
                    />
                    <p className="text-xs font-light text-gray-500 mt-2 tracking-wider">
                      Leave empty if your app configures its own port
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                      Command *
                    </label>
                    <input
                      type="text"
                      value={formData.command}
                      onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                      className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                      placeholder="npm run dev"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  CREATE PROJECT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== EDIT PROJECT MODAL ==================== */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-2xl border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Edit Project</h3>
                <button 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedProject(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateProject} className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Project Path *
                  </label>
                  <input
                    type="text"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                
onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                      Port (Optional)
                    </label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                      placeholder="Leave empty for app default"
                      min="1"
                      max="65535"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                      Command *
                    </label>
                    <input
                      type="text"
                      value={formData.command}
                      onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                      className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  UPDATE PROJECT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedProject(null);
                    resetForm();
                  }}
                  className="flex-1 border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DELETE PROJECT MODAL ==================== */}
      {showDeleteModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-md border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Delete Project</h3>
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedProject(null);
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <AlertCircle className="w-12 h-12 text-gray-900 mb-4" />
                <p className="text-gray-700 font-light mb-2">
                  Are you sure you want to delete <strong className="font-medium">{selectedProject.name}</strong>?
                </p>
                <p className="text-sm text-gray-500 font-light">
                  This action cannot be undone. The project will be permanently removed.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleDeleteProject}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  DELETE
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedProject(null);
                  }}
                  className="flex-1 border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PROJECT STATUS MODAL ==================== */}
      {showStatusModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-3xl border border-gray-200 modal-content max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-6 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Project Status</h3>
                <button 
                  onClick={() => {
                    setShowStatusModal(false);
                    setSelectedProject(null);
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Project Info */}
              <div className="mb-8">
                <h4 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-4">
                  Project Information
                </h4>
                <div className="border border-gray-200 bg-white">
                  <div className="grid grid-cols-2 gap-px bg-gray-200">
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">Name</p>
                      <p className="font-medium">{selectedProject.name}</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">Status</p>
                      <p className="font-medium">
                        {projectStatuses.get(selectedProject.id)?.running ? 'RUNNING' : 'STOPPED'}
                      </p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">Path</p>
                      <p className="font-light text-sm break-all">{selectedProject.path}</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">Command</p>
                      <p className="font-light text-sm">{selectedProject.command}</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">Port</p>
                      <p className="font-light text-sm">
                        {selectedProject.port || 'App default'}
                      </p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">PID</p>
                      <p className="font-light text-sm">
                        {projectStatuses.get(selectedProject.id)?.pid || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Runtime Stats */}
              {projectStatuses.get(selectedProject.id)?.running && (
                <div className="mb-8">
                  <h4 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-4">
                    Runtime Statistics
                  </h4>
                  <div className="grid grid-cols-2 gap-px bg-gray-200">
                    <div className="bg-white p-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Cpu className="w-5 h-5 text-gray-900" />
                        <p className="text-xs font-light text-gray-500 tracking-widest uppercase">CPU Usage</p>
                      </div>
                      <p className="text-3xl font-light">
                        {projectStatuses.get(selectedProject.id)?.cpu_usage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-white p-6">
                      <div className="flex items-center gap-3 mb-2">
                        <HardDrive className="w-5 h-5 text-gray-900" />
                        <p className="text-xs font-light text-gray-500 tracking-widest uppercase">Memory Usage</p>
                      </div>
                      <p className="text-3xl font-light">
                        {projectStatuses.get(selectedProject.id)?.memory_usage.toFixed(0)} MB
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Info */}
              {selectedProject.agent && (
                <div className="mb-8">
                  <h4 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-4">
                    Agent Information
                  </h4>
                  <div className="border border-gray-200 bg-white p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium text-lg mb-1">{selectedProject.agent.name}</p>
                        <p className="text-sm font-light text-gray-500">
                          {selectedProject.agent.status === 'online' ? 'Online' : 'Offline'}
                        </p>
                      </div>
                      <span className={`w-3 h-3 rounded-full ${
                        selectedProject.agent.status === 'online' ? 'bg-gray-900' : 'bg-gray-400'
                      }`}></span>
                    </div>
                    {selectedProject.agent.last_heartbeat && (
                      <p className="text-xs font-light text-gray-500 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Last heartbeat: {new Date(selectedProject.agent.last_heartbeat).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div>
                <h4 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-4">
                  Timestamps
                </h4>
                <div className="border border-gray-200 bg-white">
                  <div className="grid grid-cols-1 gap-px bg-gray-200">
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">Created</p>
                      <p className="font-light text-sm">
                        {new Date(selectedProject.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">Last Updated</p>
                      <p className="font-light text-sm">
                        {new Date(selectedProject.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-1">Last Started</p>
                      <p className="font-light text-sm">
                        {selectedProject.last_started 
                          ? new Date(selectedProject.last_started).toLocaleString()
                          : 'Never started'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedProject(null);
                }}
                className="w-full border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE AGENT MODAL ==================== */}
      {showCreateAgentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-md border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Create New Agent</h3>
                <button 
                  onClick={() => {
                    setShowCreateAgentModal(false);
                    setAgentFormData({ name: '' });
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateAgent} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={agentFormData.name}
                  onChange={(e) => setAgentFormData({ name: e.target.value })}
                  className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                  placeholder="my-server-01"
                  required
                />
                <p className="text-xs font-light text-gray-500 mt-2 tracking-wider">
                  Choose a descriptive name for your agent (e.g., "production-server", "dev-machine")
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  CREATE AGENT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateAgentModal(false);
                    setAgentFormData({ name: '' });
                  }}
                  className="flex-1 border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== AGENT API KEY MODAL ==================== */}
      {showAgentApiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-2xl border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Agent Created Successfully</h3>
                <button 
                  onClick={() => {
                    setShowAgentApiKeyModal(false);
                    setNewAgentApiKey('');
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <Shield className="w-12 h-12 text-gray-900 mb-4" />
                <p className="text-gray-700 font-light mb-4">
                  Your agent has been created! Here's your API key. <strong className="font-medium">Save it now</strong> - you won't be able to see it again.
                </p>
                
                <div className="bg-gray-50 border border-gray-200 p-4 mb-4">
                  <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-2">API Key</p>
                  <code className="block font-mono text-sm break-all text-gray-900 mb-3">
                    {newAgentApiKey}
                  </code>
                  <button
                    onClick={copyApiKeyToClipboard}
                    className="w-full border border-gray-300 bg-white text-gray-900 py-2 px-4 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer text-sm"
                  >
                    COPY TO CLIPBOARD
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-light text-gray-700 tracking-wider uppercase mb-4">
                  Setup Instructions
                </h4>
                <ol className="space-y-3 text-sm font-light text-gray-700 list-decimal list-inside">
                  <li>Install Python dependencies: <code className="bg-gray-100 px-2 py-1 font-mono text-xs">pip install requests psutil</code></li>
                  <li>Download the agent script from: <code className="bg-gray-100 px-2 py-1 font-mono text-xs">{window.location.origin}/agent.py</code></li>
                  <li>Run the agent: <code className="bg-gray-100 px-2 py-1 font-mono text-xs">python agent.py {window.location.origin} [API_KEY]</code></li>
                </ol>
                
                <button
                  onClick={downloadAgentScript}
                  className="w-full mt-4 border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                >
                  DOWNLOAD SETUP INSTRUCTIONS
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <button
                onClick={() => {
                  setShowAgentApiKeyModal(false);
                  setNewAgentApiKey('');
                }}
                className="w-full bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
              >
                I'VE SAVED THE API KEY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE AGENT MODAL ==================== */}
      {showDeleteAgentModal && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-md border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Delete Agent</h3>
                <button 
                  onClick={() => {
                    setShowDeleteAgentModal(false);
                    setSelectedAgent(null);
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <AlertCircle className="w-12 h-12 text-gray-900 mb-4" />
                <p className="text-gray-700 font-light mb-2">
                  Are you sure you want to delete agent <strong className="font-medium">{selectedAgent.name}</strong>?
                </p>
                <p className="text-sm text-gray-500 font-light">
                  This will permanently remove the agent and stop all associated projects. This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleDeleteAgent}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  DELETE
                </button>
                <button
                  onClick={() => {
                    setShowDeleteAgentModal(false);
                    setSelectedAgent(null);
                  }}
                  className="flex-1 border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CertionDashboard;

