import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { Shield, Plus, Trash2, AlertCircle, X, Download, Upload, Settings } from 'lucide-react';
import FirewallConfigModal from '../components/FirewallConfigModal';
import FirewallAccessRequestsModal from '../components/FirewallAccessRequestsModal';

// Define interfaces for type safety
interface Rule {
  id: string;
  rule_type: 'path' | 'method' | 'pattern';
  value: string;
  description: string;
  created_at: string;
}

interface NewRuleForm {
  rule_type: 'path' | 'method' | 'pattern';
  value: string;
  description: string;
}

interface ApiErrorResponse {
  error: string;
}

interface FirewallViewProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const FirewallView = ({ showToast }: FirewallViewProps) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showAccessRequestsModal, setShowAccessRequestsModal] = useState<boolean>(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  
  // Form state for adding new rules
  const [newRule, setNewRule] = useState<NewRuleForm>({
    rule_type: 'path',
    value: '',
    description: ''
  });
  
  // Import/export state
  const [importData, setImportData] = useState<string>('');

  // Load projects on component mount
  useEffect(() => {
    fetchProjects();
    
    // Check URL parameters for modal state
    const urlParams = new URLSearchParams(window.location.search);
    const showModal = urlParams.get('modal');
    const projectId = urlParams.get('projectId');
    
    if (showModal === 'access-requests' && projectId) {
      setShowAccessRequestsModal(true);
    }
  }, []);

  // Load rules when a project is selected
  useEffect(() => {
    if (selectedProject) {
      fetchRules(selectedProject.id);
      
      // Check URL parameters for modal state
      const urlParams = new URLSearchParams(window.location.search);
      const showModal = urlParams.get('modal');
      const urlProjectId = urlParams.get('projectId');
      
      if (showModal === 'access-requests' && urlProjectId === selectedProject.id) {
        setShowAccessRequestsModal(true);
      }
    }
  }, [selectedProject]);

  // Update URL when access requests modal is opened/closed
  useEffect(() => {
    if (showAccessRequestsModal && selectedProject) {
      // Add parameters to URL without refreshing the page
      const url = new URL(window.location.href);
      url.searchParams.set('modal', 'access-requests');
      url.searchParams.set('projectId', selectedProject.id);
      window.history.pushState({}, '', url);
    } else {
      // Remove parameters from URL when modal is closed
      const url = new URL(window.location.href);
      url.searchParams.delete('modal');
      url.searchParams.delete('projectId');
      window.history.pushState({}, '', url);
    }
  }, [showAccessRequestsModal, selectedProject]);

  // Fetch all projects
  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      if (response.data.success) {
        setProjects(response.data.projects || []);
        
        // Auto-select the first project if available
        if (response.data.projects && response.data.projects.length > 0) {
          // Check if we have a project ID in URL parameters
          const urlParams = new URLSearchParams(window.location.search);
          const projectId = urlParams.get('projectId');
          
          if (projectId) {
            const project = response.data.projects.find((p: { id: number; name: string }) => p.id.toString() === projectId);
            if (project) {
              setSelectedProject({
                id: project.id.toString(),
                name: project.name
              });
              return;
            }
          }
          
          // Default to first project if no project ID in URL or project not found
          setSelectedProject({
            id: response.data.projects[0].id.toString(),
            name: response.data.projects[0].name
          });
        }
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      showToast('Failed to load projects', 'error');
    }
  };

  // Fetch all firewall rules for the selected project
  const fetchRules = async (projectId: string) => {
    setLoading(true);
    try {
      const response = await axios.get<{ rules: Rule[] }>(`/api/projects/${projectId}/firewall/rules`);
      setRules(response.data.rules || []);
      setError(null);
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to load firewall rules';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewRule(prev => ({ ...prev, [name]: value }));
  };

  // Add a new rule
  const addRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedProject) {
      showToast('Please select a project first', 'error');
      return;
    }
    
    // Basic validation
    if (!newRule.value) {
      setError('Rule value cannot be empty');
      return;
    }
    
    // Path rules should start with /
    if (newRule.rule_type === 'path' && !newRule.value.startsWith('/')) {
      setNewRule(prev => ({ ...prev, value: '/' + prev.value }));
    }
    
    try {
      const response = await axios.post<{ rule: Rule }>(
        `/api/projects/${selectedProject.id}/firewall/rules`, 
        newRule
      );
      setRules(prev => [...prev, response.data.rule]);
      
      // Reset form and close modal
      resetForm();
      setShowAddModal(false);
      setError(null);
      showToast('Firewall rule added successfully', 'success');
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to add firewall rule';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  // Delete a rule
  const deleteRule = async () => {
    if (!selectedRule || !selectedProject) return;
    
    try {
      await axios.delete(`/api/projects/${selectedProject.id}/firewall/rules/${selectedRule.id}`);
      setRules(prev => prev.filter(rule => rule.id !== selectedRule.id));
      setShowDeleteModal(false);
      setSelectedRule(null);
      showToast('Firewall rule deleted successfully', 'success');
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to delete firewall rule';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  // Import rules from JSON
  const importRules = async () => {
    if (!selectedProject) {
      showToast('Please select a project first', 'error');
      return;
    }
    
    try {
      // Parse the JSON input
      const data = JSON.parse(importData);
      
      // Send to API
      const response = await axios.post<{ rules: Rule[] }>(
        `/api/projects/${selectedProject.id}/firewall/import`, 
        data
      );
      
      // Update rules list
      setRules(response.data.rules || []);
      
      // Reset form and close modal
      setImportData('');
      setShowImportModal(false);
      setError(null);
      showToast('Firewall rules imported successfully', 'success');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format');
        showToast('Invalid JSON format', 'error');
      } else {
        const axiosError = err as AxiosError<ApiErrorResponse>;
        const errorMsg = axiosError.response?.data?.error || 'Failed to import firewall rules';
        setError(errorMsg);
        showToast(errorMsg, 'error');
      }
    }
  };

  // Export rules to JSON
  const exportRules = async () => {
    if (!selectedProject) {
      showToast('Please select a project first', 'error');
      return;
    }
    
    try {
      const response = await axios.get(`/api/projects/${selectedProject.id}/firewall/export`);
      
      // Create downloadable JSON file
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `firewall-rules-project-${selectedProject.id}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showToast('Firewall rules exported successfully', 'success');
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to export firewall rules';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  // Get rule type display name
  const getRuleTypeDisplay = (type: string): string => {
    switch(type) {
      case 'path': return 'Path';
      case 'method': return 'HTTP Method';
      case 'pattern': return 'Regex Pattern';
      default: return type;
    }
  };

  const resetForm = () => {
    setNewRule({
      rule_type: 'path',
      value: '',
      description: ''
    });
  };

  const openDeleteModal = (rule: Rule) => {
    setSelectedRule(rule);
    setShowDeleteModal(true);
  };

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    const project = projects.find(p => p.id.toString() === projectId);
    if (project) {
      setSelectedProject({
        id: project.id.toString(),
        name: project.name
      });
    } else {
      setSelectedProject(null);
    }
  };

  // Handle opening the access requests modal
  const openAccessRequestsModal = () => {
    if (selectedProject) {
      setShowAccessRequestsModal(true);
    }
  };

  // Handle closing the access requests modal
  const closeAccessRequestsModal = () => {
    setShowAccessRequestsModal(false);
  };

  return (
    <>
      <div>
        {/* Header Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-light mb-4">Firewall Rules</h2>
          <p className="text-lg font-light text-gray-700 max-w-3xl">
            Configure which endpoints are blocked on your subdomain. This prevents malicious users from accessing sensitive areas of your application.
          </p>
        </div>

        {/* Project Selector */}
        <div className="mb-8">
          <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
            Select Project
          </label>
          <div className="flex gap-4">
            <select
              value={selectedProject?.id || ''}
              onChange={handleProjectChange}
              className="flex-1 border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
            >
              <option value="">Select a project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button 
              onClick={() => setShowAddModal(true)}
              disabled={!selectedProject}
              className="bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider flex items-center gap-2 border-none cursor-pointer transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>ADD RULE</span>
            </button>
            <button 
              onClick={() => setShowConfigModal(true)}
              disabled={!selectedProject}
              className="border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider flex items-center gap-2 cursor-pointer transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <Settings className="w-4 h-4" />
              <span>SETTINGS</span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-light">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 bg-transparent border-none cursor-pointer p-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {selectedProject ? (
          <>
            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 mb-8">
              <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                    Total Rules
                  </h3>
                  <p className="text-4xl font-light">{rules.length}</p>
                </div>
                <p className="text-sm font-light text-gray-500">Active firewall rules</p>
              </div>
              <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                    Path Rules
                  </h3>
                  <p className="text-4xl font-light">
                    {rules.filter(r => r.rule_type === 'path').length}
                  </p>
                </div>
                <p className="text-sm font-light text-gray-500">Blocked paths</p>
              </div>
              <div className="bg-white p-8 hover:bg-gray-50 transition-colors">
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                    Method Rules
                  </h3>
                  <p className="text-4xl font-light">
                    {rules.filter(r => r.rule_type === 'method').length}
                  </p>
                </div>
                <p className="text-sm font-light text-gray-500">Blocked methods</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>IMPORT RULES</span>
              </button>
              <button
                onClick={exportRules}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>EXPORT RULES</span>
              </button>
              <button
                onClick={openAccessRequestsModal}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span>ACCESS REQUESTS</span>
              </button>
            </div>

            {/* Rules List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500 font-light tracking-wider">Loading rules...</p>
                </div>
              </div>
            ) : rules.length === 0 ? (
              <div className="border border-gray-200 bg-white p-16 text-center">
                <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-2xl font-light mb-2">No Firewall Rules</h3>
                <p className="text-gray-500 font-light mb-6">
                  Create your first firewall rule to protect your application
                </p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider inline-flex items-center gap-2 border-none cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>ADD RULE</span>
                </button>
              </div>
            ) : (
              <div className="border border-gray-200 bg-white">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-light text-gray-500 uppercase tracking-widest">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-light text-gray-500 uppercase tracking-widest">
                        Value
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-light text-gray-500 uppercase tracking-widest">
                        Description
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-light text-gray-500 uppercase tracking-widest">
                        Created
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-light text-gray-500 uppercase tracking-widest">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rules.map(rule => (
                      <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium">
                            {getRuleTypeDisplay(rule.rule_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1">
                            {rule.value}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-light text-gray-600">
                            {rule.description || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-light text-gray-500">
                            {new Date(rule.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => openDeleteModal(rule)}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-light text-sm tracking-wider transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="border border-gray-200 bg-white p-16 text-center">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-light mb-2">Select a Project</h3>
            <p className="text-gray-500 font-light">
              Please select a project to manage its firewall rules
            </p>
          </div>
        )}
      </div>

      {/* ADD RULE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-2xl border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Add Firewall Rule</h3>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                    setError(null);
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={addRule} className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Rule Type *
                  </label>
                  <select
                    name="rule_type"
                    value={newRule.rule_type}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                  >
                    <option value="path">Path</option>
                    <option value="method">HTTP Method</option>
                    <option value="pattern">Regex Pattern</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    {newRule.rule_type === 'path' ? 'Path to block *' : 
                     newRule.rule_type === 'method' ? 'HTTP Method *' : 'Regex Pattern *'}
                  </label>
                  {newRule.rule_type === 'method' ? (
                    <select
                      name="value"
                      value={newRule.value}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                      required
                    >
                      <option value="">Select Method</option>
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                      <option value="OPTIONS">OPTIONS</option>
                      <option value="HEAD">HEAD</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="value"
                      value={newRule.value}
                      onChange={handleInputChange}
                      placeholder={newRule.rule_type === 'path' ? '/admin/login' : '^/api/users/\\d+/delete$'}
                      className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={newRule.description}
                    onChange={handleInputChange}
                    placeholder="Block admin login page"
                    className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  ADD RULE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                    setError(null);
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

      {/* DELETE RULE MODAL */}
      {showDeleteModal && selectedRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-md border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Delete Rule</h3>
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedRule(null);
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
                  Are you sure you want to delete this firewall rule?
                </p>
                <div className="bg-gray-50 border border-gray-200 p-4 mt-4">
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="font-medium">Type:</span> {getRuleTypeDisplay(selectedRule.rule_type)}
                    </div>
                    <div>
                      <span className="font-medium">Value:</span> <code className="bg-gray-200 px-2 py-1">{selectedRule.value}</code>
                    </div>
                    {selectedRule.description && (
                      <div>
                        <span className="font-medium">Description:</span> {selectedRule.description}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 font-light mt-4">
                  This action cannot be undone. The rule will be permanently removed.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={deleteRule}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  DELETE
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedRule(null);
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

      {/* IMPORT RULES MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4">
          <div className="bg-white w-full max-w-2xl border border-gray-200 modal-content">
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-light tracking-wider">Import Rules from JSON</h3>
                <button 
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setError(null);
                  }}
                  className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                  JSON Data
                </label>
                <textarea
                  value={importData}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImportData(e.target.value)}
                  placeholder={`{
  "blocked_paths": [
    "/admin/login",
    "/wp-admin"
  ],
  "blocked_methods": [
    "DELETE"
  ],
  "path_patterns": [
    "^/api/users/\\\\d+/delete$"
  ]
}`}
                  className="w-full h-64 border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={importRules}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  IMPORT
                </button>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setError(null);
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

      {/* FIREWALL CONFIG MODAL */}
      {selectedProject && (
        <FirewallConfigModal
          projectId={selectedProject.id}
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onConfigSaved={() => {
            // You could potentially refresh some data here if needed
            setError(null);
            showToast('Firewall configuration saved', 'success');
          }}
        />
      )}

      {/* FIREWALL ACCESS REQUESTS MODAL */}
      {selectedProject && (
        <FirewallAccessRequestsModal
          projectId={selectedProject.id}
          isOpen={showAccessRequestsModal}
          onClose={closeAccessRequestsModal}
        />
      )}
    </>
  );
};

export default FirewallView;