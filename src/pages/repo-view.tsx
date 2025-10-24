import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Star, 
  GitFork, 
  Upload, 
  Download, 
  FolderOpen,
  File,
  Calendar,
  Code,
  AlertCircle,
  GitCommit,
  Lock,
  Globe,
  ChevronRight,
  ArrowLeft,
  Settings,
  GitBranch,
} from 'lucide-react';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  is_private: boolean;
  language: string;
  stars_count: number;
  forks_count: number;
  issues_count: number;
  commits_count: number;
  size: number;
  created_at: string;
  updated_at: string;
  owner: {
    username: string;
    avatar_url: string;
  };
  is_starred: boolean;
  is_forked: boolean;
}

interface FileEntry {
  type: 'file' | 'dir';
  name: string;
  path: string;
  size?: number;
}

const RepoView = () => {
  const { username, reponame, '*': treePath } = useParams();
  const navigate = useNavigate();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [view, setView] = useState<'code' | 'settings'>('code');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [uploadPath, setUploadPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  useEffect(() => {
    if (username && reponame) {
      fetchRepository();
      fetchRepoFiles(treePath || '');
    }
  }, [username, reponame, treePath]);

  const fetchRepository = async () => {
    try {
      // First get all repos to find the one we want
      const response = await fetch('/r/api/repos');
      if (response.ok) {
        const data = await response.json();
        const repo = data.repos.find((r: Repository) => 
          r.owner.username === username && r.name === reponame
        );
        if (repo) {
          setRepository(repo);
        } else {
          // Repository not found
          navigate('/repositories');
        }
      }
    } catch (error) {
      console.error('Failed to fetch repository:', error);
      navigate('/repositories');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepoFiles = async (path: string = '') => {
    if (!repository) return;
    
    try {
      const response = await fetch(`/r/api/repos/${repository.id}/files?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.entries);
        setCurrentPath(data.current_path);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  const handleStarRepo = async () => {
    if (!repository) return;
    
    try {
      const method = repository.is_starred ? 'DELETE' : 'POST';
      const response = await fetch(`/r/api/repos/${repository.id}/star`, { method });
      if (response.ok) {
        const data = await response.json();
        setRepository(prev => prev ? {
          ...prev,
          is_starred: data.starred,
          stars_count: data.stars_count
        } : null);
      }
    } catch (error) {
      console.error('Failed to star/unstar repository:', error);
    }
  };

  const handleForkRepo = async () => {
    if (!repository) return;
    
    try {
      const response = await fetch(`/r/api/repos/${repository.id}/fork`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        alert(`Repository forked as ${data.fork.full_name}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to fork repository');
      }
    } catch (error) {
      console.error('Failed to fork repository:', error);
    }
  };

  const handleUploadFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles || !repository) return;

    const formData = new FormData();
    formData.append('path', uploadPath);
    Array.from(selectedFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/r/api/repos/${repository.id}/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setShowUpload(false);
        setSelectedFiles(null);
        setUploadPath('');
        fetchRepoFiles(currentPath);
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const navigateToPath = (path: string) => {
    if (path) {
      navigate(`/r/${username}/${reponame}/tree/${path}`);
    } else {
      navigate(`/r/${username}/${reponame}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading repository...</p>
        </div>
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Repository not found</h2>
          <p className="text-gray-600 mb-4">The repository you're looking for doesn't exist.</p>
          <Link
            to="/repositories"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to repositories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Repository Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              to="/repositories"
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to repositories</span>
            </Link>
          </div>
          
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <img
                src={repository.owner.avatar_url}
                alt={repository.owner.username}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    <Link 
                      to={`/profile/${repository.owner.username}`}
                      className="hover:text-blue-600"
                    >
                      {repository.owner.username}
                    </Link>
                    <span className="text-gray-400 mx-2">/</span>
                    <span className="text-blue-600">{repository.name}</span>
                  </h1>
                  {repository.is_private ? (
                    <Lock className="w-5 h-5 text-gray-500" />
                  ) : (
                    <Globe className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                {repository.description && (
                  <p className="text-gray-600 mt-1">{repository.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleStarRepo}
                className={`flex items-center space-x-1 px-3 py-2 rounded-lg border transition-colors ${
                  repository.is_starred
                    ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Star className={`w-4 h-4 ${repository.is_starred ? 'fill-current' : ''}`} />
                <span>Star</span>
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {repository.stars_count}
                </span>
              </button>

              <button
                onClick={handleForkRepo}
                className="flex items-center space-x-1 px-3 py-2 rounded-lg border bg-white border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <GitFork className="w-4 h-4" />
                <span>Fork</span>
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {repository.forks_count}
                </span>
              </button>

              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Upload files</span>
              </button>
            </div>
          </div>

          {/* Repository Stats */}
          <div className="flex items-center space-x-6 mt-4 text-sm text-gray-600">
            {repository.language && (
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>{repository.language}</span>
              </div>
            )}
            <div className="flex items-center space-x-1">
              <GitCommit className="w-4 h-4" />
              <span>{repository.commits_count} commits</span>
            </div>
            <div className="flex items-center space-x-1">
              <GitBranch className="w-4 h-4" />
              <span>main</span>
            </div>
            <div className="flex items-center space-x-1">
              <AlertCircle className="w-4 h-4" />
              <span>{repository.issues_count} issues</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>Updated {formatDate(repository.updated_at)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>{formatFileSize(repository.size * 1024)}</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-6 mt-6 border-b">
            <button
              onClick={() => setView('code')}
              className={`flex items-center space-x-2 pb-3 border-b-2 transition-colors ${
                view === 'code'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Code</span>
            </button>
            <button
              onClick={() => setView('settings')}
              className={`flex items-center space-x-2 pb-3 border-b-2 transition-colors ${
                view === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {view === 'code' ? (
          <div className="bg-white rounded-lg border">
            {/* Path Breadcrumb */}
            {currentPath && (
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center space-x-2 text-sm">
                  <button
                    onClick={() => navigateToPath('')}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {repository.name}
                  </button>
                  {currentPath.split('/').map((segment, index, array) => (
                    <React.Fragment key={index}>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <button
                        onClick={() => {
                          const path = array.slice(0, index + 1).join('/');
                          navigateToPath(path);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {segment}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* File List */}
            <div className="divide-y">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    {file.type === 'dir' ? (
                      <FolderOpen className="w-5 h-5 text-blue-500" />
                    ) : (
                      <File className="w-5 h-5 text-gray-400" />
                    )}
                    <button
                      onClick={() => {
                        if (file.type === 'dir') {
                          navigateToPath(file.path);
                        } else {
                          window.open(`/r/${repository.full_name}/raw/${file.path}`, '_blank');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {file.name}
                    </button>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    {file.size !== undefined && (
                      <span>{formatFileSize(file.size)}</span>
                    )}
                    {file.type === 'file' && (
                      <a
                        href={`/r/${repository.full_name}/download/${file.path}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>This directory is empty</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Repository Settings</h2>
            <p className="text-gray-600">Settings functionality would go here...</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Upload Files</h3>
            <form onSubmit={handleUploadFiles}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destination Path (optional)
                </label>
                <input
                  type="text"
                  value={uploadPath}
                  onChange={(e) => setUploadPath(e.target.value)}
                  placeholder="folder/subfolder/"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Files
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFiles}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepoView;