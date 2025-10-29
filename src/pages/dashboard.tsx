import { useState, useEffect } from 'react';
import Header from './header';
import Nav from './nav';
import { Shield, AlertCircle, Activity } from 'lucide-react';
import DashboardOverview from './dashboard-overview';
import ProjectsView from './projects';
import AgentsView from './agents';
import RepositoryComponent from './repo';
import FirewallView from './firewall-view';

// Types
export type User = {
  username: string;
  email: string;
  avatar_url?: string;
};

export type Deployment = {
  id: number;
  project_id: number;
  subdomain: string;
  url: string;
  status: string;
  ssl_enabled: boolean;
  created_at: string;
};

export type Agent = {
  id: number;
  name: string;
  status: 'online' | 'offline';
  last_heartbeat: string | null;
  system_info: any;
  created_at: string;
};

export type Project = {
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
  is_public: boolean;
  subdomain?: string;
  tunnel_port?: number;
  public_url?: string;
};

export type ProjectStatus = {
  running: boolean;
  pid: number | null;
  cpu_usage: number;
  memory_usage: number;
  port: number | null;
  last_started: string | null;
};

export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Auth Service
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

const CertionDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  const [user, setUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: ToastType }>({
    show: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 3000);
  };

  // Load agents function
  const loadAgents = async () => {
    try {
      const res = await fetch('/api/agents', {
        method: 'GET',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

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

  // Load agents on mount
  useEffect(() => {
    loadAgents();
  }, []);

  // Add event listener for navigation events from other components
  useEffect(() => {
    const handleNavigation = (event: CustomEvent) => {
      if (event.detail && event.detail.tab) {
        setActiveTab(event.detail.tab);
      }
    };

    window.addEventListener('navigate', handleNavigation as EventListener);
    
    return () => {
      window.removeEventListener('navigate', handleNavigation as EventListener);
    };
  }, []);

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
          projectsCount={0}
          agents={agents}
          onClose={() => setSidebarOpen(false)}
          onTabClick={setActiveTab}
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
            {activeTab === 'dashboard' && (
              <DashboardOverview user={user} />
            )}

            {activeTab === 'projects' && (
              <ProjectsView showToast={showToast} />
            )}

            {activeTab === 'agents' && (
              <AgentsView 
                showToast={showToast}
                agents={agents}
                onAgentsChange={loadAgents}
              />
            )}

            {activeTab === 'repositories' && (
              <RepositoryComponent />
            )}

            {activeTab === 'firewall' && (
              <FirewallView showToast={showToast} />
            )}

            {/* Other tabs placeholder */}
            {!['dashboard', 'projects', 'agents', 'repositories', 'firewall'].includes(activeTab) && (
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
    </>
  );
};

export default CertionDashboard;