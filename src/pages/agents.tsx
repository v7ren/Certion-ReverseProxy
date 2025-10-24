import { useState } from 'react';
import { Plus, Cpu, Trash2, HardDrive, Activity, Clock, Shield, X } from 'lucide-react';
import type { Agent, ToastType } from './dashboard';

// Agents Service
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

interface AgentsViewProps {
  showToast: (message: string, type: ToastType) => void;
  agents: Agent[];  // ✅ ADDED
  onAgentsChange: () => void;  // ✅ ADDED
}

const AgentsView = ({ showToast, agents, onAgentsChange }: AgentsViewProps) => {  // ✅ UPDATED
  // ❌ REMOVED: const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [showAgentApiKeyModal, setShowAgentApiKeyModal] = useState(false);
  const [showDeleteAgentModal, setShowDeleteAgentModal] = useState(false);
  const [newAgentApiKey, setNewAgentApiKey] = useState('');
  const [agentFormData, setAgentFormData] = useState({ name: '' });

  // ❌ REMOVED: useEffect(() => { loadAgents(); }, []);
  // ❌ REMOVED: const loadAgents = async () => { ... };

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
      onAgentsChange();  // ✅ CHANGED from loadAgents()
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
      onAgentsChange();  // ✅ CHANGED from loadAgents()
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

  return (
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
                  placeholder="my-server-agent"
                  required
                />
                <p className="text-xs font-light text-gray-500 mt-2">
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
                  <code className="text-sm font-mono break-all">{newAgentApiKey}</code>
                </div>

                <div className="flex gap-3 mb-6">
                  <button
                    onClick={copyApiKeyToClipboard}
                    className="flex-1 border border-gray-300 bg-white text-gray-900 py-2 px-4 hover:bg-gray-50 font-light text-sm tracking-wider transition-colors cursor-pointer"
                  >
                    COPY TO CLIPBOARD
                  </button>
                  <button
                    onClick={downloadAgentScript}
                    className="flex-1 border border-gray-300 bg-white text-gray-900 py-2 px-4 hover:bg-gray-50 font-light text-sm tracking-wider transition-colors cursor-pointer"
                  >
                    DOWNLOAD SETUP INSTRUCTIONS
                  </button>
                </div>

                <div className="bg-gray-50 border border-gray-200 p-4">
                  <p className="text-xs font-light text-gray-500 tracking-widest uppercase mb-2">Setup Instructions</p>
                  <ol className="text-sm font-light text-gray-700 space-y-2 list-decimal list-inside">
                    <li>Install dependencies: <code className="bg-white px-2 py-1 text-xs">pip install requests psutil</code></li>
                    <li>Download agent.py from: <code className="bg-white px-2 py-1 text-xs">{window.location.origin}/agent.py</code></li>
                    <li>Run: <code className="bg-white px-2 py-1 text-xs">python agent.py {window.location.origin} [API_KEY]</code></li>
                  </ol>
                </div>
              </div>

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
                <Shield className="w-12 h-12 text-gray-900 mb-4" />
                <p className="text-gray-700 font-light mb-2">
                  Are you sure you want to delete <strong className="font-medium">{selectedAgent.name}</strong>?
                </p>
                <p className="text-sm text-gray-500 font-light">
                  This action cannot be undone. All projects associated with this agent will need to be reassigned.
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

export default AgentsView;
