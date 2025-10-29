import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Shield } from 'lucide-react';
import axios, { AxiosError } from 'axios';

interface FirewallConfigModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

interface FirewallConfig {
  enabled: boolean;
  auto_block_suspicious: boolean;
  rate_limit: number;
  whitelist_ips: string[];
}

interface ApiErrorResponse {
  error: string;
}

const FirewallConfigModal: React.FC<FirewallConfigModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<FirewallConfig>({
    enabled: true,
    auto_block_suspicious: false,
    rate_limit: 100,
    whitelist_ips: []
  });
  const [newIp, setNewIp] = useState<string>('');

  // Load current config when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, projectId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get<{ config: FirewallConfig }>(`/api/projects/${projectId}/firewall/config`);
      setConfig(response.data.config);
      setError(null);
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      setError(axiosError.response?.data?.error || 'Failed to load firewall configuration');
      console.error('Error loading firewall configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.put(`/api/projects/${projectId}/firewall/config`, config);
      setError(null);
      onConfigSaved();
      onClose();
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      setError(axiosError.response?.data?.error || 'Failed to save firewall configuration');
      console.error('Error saving firewall configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setConfig(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'rate_limit') {
      setConfig(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setConfig(prev => ({ ...prev, [name]: value }));
    }
  };

  const addIpToWhitelist = () => {
    if (!newIp) return;
    
    // Simple IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(newIp)) {
      setError('Please enter a valid IP address or CIDR range');
      return;
    }
    
    setConfig(prev => ({
      ...prev,
      whitelist_ips: [...prev.whitelist_ips, newIp]
    }));
    setNewIp('');
  };

  const removeIpFromWhitelist = (ipToRemove: string) => {
    setConfig(prev => ({
      ...prev,
      whitelist_ips: prev.whitelist_ips.filter(ip => ip !== ipToRemove)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl border border-gray-200 modal-content" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-light tracking-wider">Firewall Configuration</h3>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 font-light tracking-wider">Loading configuration...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={saveConfig} className="p-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-light">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800 bg-transparent border-none cursor-pointer p-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="space-y-6">
              {/* Firewall Status */}
              <div className="border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-900" />
                    <label className="text-lg font-light">Firewall Status</label>
                  </div>
                  <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                    <input
                      type="checkbox"
                      id="firewall-toggle"
                      name="enabled"
                      checked={config.enabled}
                      onChange={handleInputChange}
                      className="opacity-0 w-0 h-0"
                    />
                    <label
                      htmlFor="firewall-toggle"
                      className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 ${
                        config.enabled ? 'bg-gray-900' : 'bg-gray-300'
                      } transition-colors duration-200 rounded-full`}
                    >
                      <span
                        className={`absolute left-1 bottom-1 bg-white w-4 h-4 transition-transform duration-200 rounded-full ${
                          config.enabled ? 'transform translate-x-6' : ''
                        }`}
                      ></span>
                    </label>
                  </div>
                </div>
                <p className="text-sm font-light text-gray-500 mt-2">
                  {config.enabled 
                    ? 'Firewall is active and protecting your application' 
                    : 'Firewall is disabled. Your application is not protected'}
                </p>
              </div>

              {/* Rate Limiting */}
              <div>
                <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                  Rate Limit (requests per minute)
                </label>
                <input
                  type="number"
                  name="rate_limit"
                  value={config.rate_limit}
                  onChange={handleInputChange}
                  min="1"
                  max="10000"
                  className="w-full border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                />
                <p className="text-xs font-light text-gray-500 mt-2">
                  Maximum number of requests allowed per minute from a single IP address
                </p>
              </div>

              {/* Auto-block Suspicious Activity */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto-block"
                  name="auto_block_suspicious"
                  checked={config.auto_block_suspicious}
                  onChange={handleInputChange}
                  className="w-5 h-5 border border-gray-300"
                />
                <div>
                  <label htmlFor="auto-block" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Auto-block suspicious activity
                  </label>
                  <p className="text-xs font-light text-gray-500">
                    Automatically block IPs that show suspicious behavior patterns
                  </p>
                </div>
              </div>

              {/* IP Whitelist */}
              <div>
                <label className="block text-sm font-light text-gray-700 tracking-wider uppercase mb-2">
                  IP Whitelist
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="192.168.1.1 or 10.0.0.0/24"
                    className="flex-1 border border-gray-300 py-3 px-4 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={addIpToWhitelist}
                    className="bg-gray-900 text-white px-4 hover:bg-gray-800 font-light tracking-wider border-none cursor-pointer transition-colors"
                  >
                    ADD
                  </button>
                </div>
                <p className="text-xs font-light text-gray-500 mb-3">
                  Whitelisted IPs will bypass rate limiting and other restrictions
                </p>

                {/* IP List */}
                {config.whitelist_ips.length > 0 ? (
                  <div className="border border-gray-200 max-h-40 overflow-y-auto">
                    <table className="w-full">
                      <tbody className="divide-y divide-gray-200">
                        {config.whitelist_ips.map((ip) => (
                          <tr key={ip} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-mono">{ip}</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeIpFromWhitelist(ip)}
                                className="text-gray-500 hover:text-gray-900 bg-transparent border-none cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm font-light text-gray-500 border border-gray-200 p-4 text-center bg-gray-50">
                    No IPs in whitelist
                  </div>
                )}
              </div>
            </div>

            {/* Help Text */}
            <div className="mt-6 bg-blue-50 border border-blue-200 p-4 text-sm font-light text-blue-800">
              <p>
                <strong className="font-medium">Note:</strong> These settings apply in addition to your specific firewall rules. 
                Rate limiting and auto-blocking provide protection against brute force and DDoS attacks.
              </p>
            </div>

            <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gray-900 text-white py-3 px-6 hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                SAVE CONFIGURATION
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 bg-white text-gray-900 py-3 px-6 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FirewallConfigModal;