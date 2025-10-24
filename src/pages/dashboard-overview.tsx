import { useState, useEffect } from 'react';
import { Activity, Code, Clock } from 'lucide-react';
import type { Agent, Project, ProjectStatus, User } from './dashboard';

// Services
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

  async getStatus(id: number): Promise<ProjectStatus> {
    const res = await fetch(`/api/projects/${id}/status`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.status;
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

interface DashboardOverviewProps {
  user: User | null;
}

const DashboardOverview = ({ user }: DashboardOverviewProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<Map<number, ProjectStatus>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsData, agentsData] = await Promise.all([
        projectsService.getAll(),
        agentsService.getAll(),
      ]);
      setProjects(projectsData);
      setAgents(agentsData);

      // Load statuses
      const statusMap = new Map<number, ProjectStatus>();
      await Promise.all(
        projectsData.map(async (project) => {
          try {
            const status = await projectsService.getStatus(project.id);
            statusMap.set(project.id, status);
          } catch (error) {
            console.error(`Failed to get status for project ${project.id}`, error);
          }
        })
      );
      setProjectStatuses(statusMap);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  return (
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
  );
};

export default DashboardOverview;
