import { useState, useEffect } from 'react';
import {
  FolderOpen, Plus, Play, Square, RotateCw, Trash2,
  Edit, Eye, Terminal, Cpu, HardDrive, AlertCircle, Clock, X, Activity
} from 'lucide-react';
import type { Agent, ToastType, Project, ProjectStatus } from './dashboard';

// Projects Service
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
};

interface ProjectsViewProps {
  showToast: (message: string, type: ToastType) => void;
}

const ProjectsView = ({ showToast }: ProjectsViewProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [projectStatuses, setProjectStatuses] = useState<Map<number, ProjectStatus>>(new Map());
  const [agents, setAgents] = useState<Agent[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    path: '',
    description: '',
    port: '',
    command: 'npm run dev',
    agent_id: '',
  });

  useEffect(() => {
    loadProjects();
    loadAgents();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      const interval = setInterval(() => {
        refreshProjectStatuses();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [projects]);

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

  const loadAgents = async () => {
    try {
      const data = await agentsService.getAll();
      setAgents(data);
    } catch (error) {
      console.error('Failed to load agents:', error);
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

  return (
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
                      }`}>

</span>
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
    </>
  );
};

export default ProjectsView;
