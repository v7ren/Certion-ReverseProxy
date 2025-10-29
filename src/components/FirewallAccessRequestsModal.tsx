import React, { useState, useEffect } from 'react';
import { X, Shield, Clock, Check, AlertCircle, Info, RefreshCw, Ban } from 'lucide-react';
import axios, { AxiosError } from 'axios';

interface FirewallAccessRequestsModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface AccessRequest {
  id: number;
  project_id: number;
  ip_address: string;
  method: string;
  path: string;
  rule_id: number | null;
  block_reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  approved_until: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiErrorResponse {
  error: string;
}

const FirewallAccessRequestsModal: React.FC<FirewallAccessRequestsModalProps> = ({
  projectId,
  isOpen,
  onClose
}) => {
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'revoked'>('pending');
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshInterval, setRefreshInterval] = useState<number>(30); // seconds
  const [showRevokeAllModal, setShowRevokeAllModal] = useState<boolean>(false);
  const [revokeByIpAddress, setRevokeByIpAddress] = useState<string>('');
  const [showRevokeByIpModal, setShowRevokeByIpModal] = useState<boolean>(false);
const [refreshTimerId, setRefreshTimerId] = useState<number | null>(null);

  // Load access requests when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAccessRequests();
      
      // Set up auto-refresh
      if (isAutoRefreshing) {
        // Clear any existing timer first
        if (refreshTimerId) {
          clearInterval(refreshTimerId);
        }
        
        const timerId = setInterval(() => {
          fetchAccessRequests(false); // Don't show loading state on auto-refresh
        }, refreshInterval * 1000);
        
        setRefreshTimerId(timerId);
      }
      
      return () => {
        if (refreshTimerId) {
          clearInterval(refreshTimerId);
          setRefreshTimerId(null);
        }
      };
    }
  }, [isOpen, projectId, filter, refreshInterval, isAutoRefreshing]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerId) {
        clearInterval(refreshTimerId);
      }
    };
  }, []);

  // Update timer when auto-refresh settings change
  useEffect(() => {
    if (isOpen && isAutoRefreshing) {
      // Clear existing timer
      if (refreshTimerId) {
        clearInterval(refreshTimerId);
      }
      
      // Create new timer
      const timerId = setInterval(() => {
        fetchAccessRequests(false);
      }, refreshInterval * 1000);
      
      setRefreshTimerId(timerId);
      
      return () => {
        clearInterval(timerId);
      };
    } else if (!isAutoRefreshing && refreshTimerId) {
      clearInterval(refreshTimerId);
      setRefreshTimerId(null);
    }
  }, [isAutoRefreshing, refreshInterval]);

  // Fetch access requests
  const fetchAccessRequests = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    
    try {
      const url = `/api/projects/${projectId}/firewall/access-requests`;
      const params = filter !== 'all' ? { status: filter } : {};
      
      const response = await axios.get(url, { params });
      
      if (response.data.success) {
        setAccessRequests(response.data.access_requests || []);
        setError(null);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to load access requests';
      setError(errorMsg);
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  // Approve an access request
  const approveRequest = async (requestId: number) => {
    try {
      const response = await axios.post(
        `/api/projects/${projectId}/firewall/access-requests/${requestId}/approve`,
        { duration_minutes: durationMinutes }
      );
      
      if (response.data.success) {
        // Update the request in the list
        setAccessRequests(prev => 
          prev.map(req => 
            req.id === requestId ? response.data.access_request : req
          )
        );
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to approve access request';
      setError(errorMsg);
    }
  };

  // Reject an access request
  const rejectRequest = async (requestId: number) => {
    try {
      const response = await axios.post(
        `/api/projects/${projectId}/firewall/access-requests/${requestId}/reject`
      );
      
      if (response.data.success) {
        // Update the request in the list
        setAccessRequests(prev => 
          prev.map(req => 
            req.id === requestId ? response.data.access_request : req
          )
        );
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to reject access request';
      setError(errorMsg);
    }
  };

  // Revoke an approved access request
  const revokeRequest = async (requestId: number) => {
    try {
      const response = await axios.post(
        `/api/projects/${projectId}/firewall/access-requests/${requestId}/revoke`
      );
      
      if (response.data.success) {
        // Update the request in the list
        setAccessRequests(prev => 
          prev.map(req => 
            req.id === requestId ? response.data.access_request : req
          )
        );
        fetchAccessRequests(false); // Refresh the list to get updated status
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to revoke access request';
      setError(errorMsg);
    }
  };

  // Revoke all approved access requests
  const revokeAllApproved = async () => {
    try {
      const response = await axios.post(
        `/api/projects/${projectId}/firewall/access-requests/revoke`,
        { revoke_all: true }
      );
      
      if (response.data.success) {
        fetchAccessRequests(false); // Refresh the list
        setShowRevokeAllModal(false);
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to revoke access requests';
      setError(errorMsg);
      setShowRevokeAllModal(false); // Close modal even on error
    }
  };

  // Revoke all approved access requests for a specific IP
  const revokeByIp = async () => {
    if (!revokeByIpAddress.trim()) {
      setError('Please enter an IP address');
      return;
    }
    
    try {
      const response = await axios.post(
        `/api/projects/${projectId}/firewall/access-requests/revoke`,
        { ip_address: revokeByIpAddress.trim() }
      );
      
      if (response.data.success) {
        fetchAccessRequests(false); // Refresh the list
        setShowRevokeByIpModal(false);
        setRevokeByIpAddress('');
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errorMsg = axiosError.response?.data?.error || 'Failed to revoke access requests';
      setError(errorMsg);
      setShowRevokeByIpModal(false); // Close modal even on error
    }
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  // Format time ago
  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec} seconds ago`;
    
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  };

  // Get time remaining for approved requests
  const getTimeRemaining = (approvedUntil: string | null) => {
    if (!approvedUntil) return null;
    
    const endTime = new Date(approvedUntil).getTime();
    const now = new Date().getTime();
    const diff = endTime - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setIsAutoRefreshing(!isAutoRefreshing);
  };

  // Handle closing the modal
  const handleClose = () => {
    // Clean up timer
    if (refreshTimerId) {
      clearInterval(refreshTimerId);
      setRefreshTimerId(null);
    }
    onClose();
  };

  // Get count of approved requests
  const approvedRequestsCount = accessRequests.filter(req => req.status === 'approved').length;

  // Get unique IP addresses with approved requests
  const uniqueIpsWithApprovedRequests = [...new Set(
    accessRequests
      .filter(req => req.status === 'approved')
      .map(req => req.ip_address)
  )];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal-overlay p-4" onClick={handleClose}>
      <div className="bg-white w-full max-w-6xl border border-gray-200 modal-content max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-light tracking-wider flex items-center">
              <Shield className="w-6 h-6 mr-2 text-gray-500" />
              Firewall Access Requests
            </h3>
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-1 text-gray-600 font-light">
            Manage temporary access requests to firewall-blocked endpoints. Approve requests to grant temporary access.
          </p>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-light">Filter:</label>
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="text-sm border border-gray-300 py-1.5 px-3 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
              >
                <option value="all">All Requests</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-light">Auto-refresh:</label>
              <select 
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                disabled={!isAutoRefreshing}
                className={`text-sm border border-gray-300 py-1.5 px-3 bg-white outline-none focus:border-gray-900 rounded-none transition-colors ${!isAutoRefreshing ? 'opacity-50' : ''}`}
              >
                <option value="10">10 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="300">5 minutes</option>
              </select>
              <button
                onClick={toggleAutoRefresh}
                className={`text-xs px-2 py-1 rounded-none ${isAutoRefreshing ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
              >
                {isAutoRefreshing ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-light">Approval Duration:</label>
              <select 
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="text-sm border border-gray-300 py-1.5 px-3 bg-white outline-none focus:border-gray-900 rounded-none transition-colors"
              >
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </div>
            
            {approvedRequestsCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRevokeAllModal(true)}
                  className="text-sm px-3 py-1.5 bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 transition-colors"
                >
                  Revoke All ({approvedRequestsCount})
                </button>
                
                {uniqueIpsWithApprovedRequests.length > 0 && (
                  <button
                    onClick={() => setShowRevokeByIpModal(true)}
                    className="text-sm px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-100 transition-colors"
                  >
                    Revoke By IP
                  </button>
                )}
              </div>
            )}
            
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">
                Last refreshed: {formatTimeAgo(lastRefreshed.toISOString())}
              </span>
              <button
                onClick={() => fetchAccessRequests()}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Refresh now"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Error Display */}
          {error && (
            <div className="m-4 bg-red-50 border border-red-200 p-3 rounded-none flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-light">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 bg-transparent border-none cursor-pointer p-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Access Requests List */}
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500 font-light tracking-wider">Loading access requests...</p>
              </div>
            </div>
          ) : accessRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-2xl font-light mb-2">No Access Requests</h3>
              <p className="text-gray-500 font-light">
                {filter === 'all' 
                  ? 'No access requests have been logged yet.' 
                  : `No ${filter} access requests found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-light text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-4 py-3 text-xs font-light text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-4 py-3 text-xs font-light text-gray-500 uppercase tracking-wider">
                      Path
                    </th>
                    <th className="px-4 py-3 text-xs font-light text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-light text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-xs font-light text-gray-500 uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {accessRequests.map(request => (
                    <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">{request.ip_address}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-medium ${
                          request.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                          request.method === 'POST' ? 'bg-green-100 text-green-800' :
                          request.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                          request.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {request.method}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-md overflow-hidden">
                          <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-none block truncate">
                            {request.path}
                          </code>
                          {request.block_reason && (
                            <div className="flex items-center mt-1 text-xs text-gray-500 group relative">
                              <Info className="w-3 h-3 mr-1" />
                              <span className="truncate">Reason: {request.block_reason}</span>
                              <div className="absolute bottom-full left-0 mb-2 bg-gray-900 text-white text-xs p-2 rounded-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                {request.block_reason}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-medium ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'approved' ? 'bg-green-100 text-green-800' :
                          request.status === 'revoked' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {request.status === 'approved' && <Check className="w-3 h-3 mr-1" />}
                          {request.status === 'rejected' && <X className="w-3 h-3 mr-1" />}
                          {request.status === 'revoked' && <Ban className="w-3 h-3 mr-1" />}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                        
                        {request.status === 'approved' && request.approved_until && (
                          <div className="text-xs text-gray-500 mt-1 group relative">
                            <div>Expires in: {getTimeRemaining(request.approved_until)}</div>
                            <div className="absolute bottom-full left-0 mb-2 bg-gray-900 text-white text-xs p-2 rounded-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                              {formatDate(request.approved_until)}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-500 group relative">
                          {formatTimeAgo(request.created_at)}
                          <div className="absolute bottom-full left-0 mb-2 bg-gray-900 text-white text-xs p-2 rounded-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                            {formatDate(request.created_at)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {request.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => approveRequest(request.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 text-sm transition-colors cursor-pointer"
                              title={`Approve for ${durationMinutes} minutes`}
                            >
                              <Check className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => rejectRequest(request.id)}
                              className="inline-flex items-center gap-1 px-3 py-1 border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-sm transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                              Reject
                            </button>
                          </div>
                        )}
                        {request.status === 'approved' && (
                          <button
                            onClick={() => revokeRequest(request.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-sm transition-colors cursor-pointer"
                          >
                            <Ban className="w-3 h-3" />
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {accessRequests.length > 0 ? 
              `Showing ${accessRequests.length} ${filter !== 'all' ? filter : ''} request${accessRequests.length !== 1 ? 's' : ''}` : 
              'No requests found'}
          </div>
          <div className="text-xs text-gray-500">
            Auto-refresh: {isAutoRefreshing ? `Every ${refreshInterval} seconds` : 'Off'}
          </div>
        </div>
        
        {/* Revoke All Modal */}
        {showRevokeAllModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { e.stopPropagation(); setShowRevokeAllModal(false); }}>
            <div className="bg-white w-full max-w-md p-6 border border-gray-200" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-light mb-4 flex items-center">
                <Ban className="w-5 h-5 mr-2 text-red-600" />
                Revoke All Approved Access
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to revoke all {approvedRequestsCount} approved access requests? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRevokeAllModal(false); }}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); revokeAllApproved(); }}
                  className="px-4 py-2 border border-red-500 bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Revoke All
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Revoke By IP Modal */}
        {showRevokeByIpModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { e.stopPropagation(); setShowRevokeByIpModal(false); }}>
            <div className="bg-white w-full max-w-md p-6 border border-gray-200" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-light mb-4 flex items-center">
                <Ban className="w-5 h-5 mr-2 text-orange-600" />
                Revoke Access by IP Address
              </h3>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">IP Address</label>
                <select
                  value={revokeByIpAddress}
                  onChange={(e) => setRevokeByIpAddress(e.target.value)}
                  className="w-full border border-gray-300 p-2 text-sm"
                >
                  <option value="">Select an IP address...</option>
                  {uniqueIpsWithApprovedRequests.map(ip => (
                    <option key={ip} value={ip}>{ip}</option>
                  ))}
                </select>
              </div>
              <p className="text-gray-600 mb-6">
                This will revoke all approved access for the selected IP address.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRevokeByIpModal(false); }}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); revokeByIp(); }}
                  disabled={!revokeByIpAddress}
                  className={`px-4 py-2 border border-orange-500 bg-orange-500 text-white hover:bg-orange-600 transition-colors ${!revokeByIpAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Revoke Access
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirewallAccessRequestsModal;