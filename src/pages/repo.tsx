import React, { useState, useEffect, useRef } from 'react';
import Header from './header'; // Import the header component
import { 
  Star, 
  GitFork, 
  Upload, 
  Download, 
  Plus, 
  Search, 
  FolderOpen,
  File,
  Calendar,
  Code,
  AlertCircle,
  GitCommit,
  Lock,
  Globe,
  ChevronRight,
  X,
  Clock,
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

const RepositoryComponent = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [currentRepo, setCurrentRepo] = useState<Repository | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [view, setView] = useState<'list' | 'repo' | 'upload'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New repository form state
  const [newRepo, setNewRepo] = useState({
    name: '',
    description: '',
    is_private: false,
    language: ''
  });

  // Upload form state
  const [uploadPath, setUploadPath] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  // ---- FIXED fetchRepositories ----
  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const response = await fetch('/r/api/repos');
      if (response.ok) {
        const data = await response.json();
        // Handles both { repos: [...] } and [...] response shapes
        let reposArray = [];
        if (Array.isArray(data)) {
          reposArray = data;
        } else if (Array.isArray(data.repos)) {
          reposArray = data.repos;
        }
        setRepositories(reposArray);
      } else {
        setRepositories([]);
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepoFiles = async (repoId: number, path: string = '') => {
    setLoading(true);
    try {
      const response = await fetch(`/r/api/repos/${repoId}/files?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.entries);
        setCurrentPath(data.current_path);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStarRepo = async (repo: Repository) => {
    try {
      const method = repo.is_starred ? 'DELETE' : 'POST';
      const response = await fetch(`/r/api/repos/${repo.id}/star`, { method });
      if (response.ok) {
        const data = await response.json();
        setRepositories(repos => 
          repos.map(r => 
            r.id === repo.id 
              ? { ...r, is_starred: data.starred, stars_count: data.stars_count }
              : r
          )
        );
        if (currentRepo?.id === repo.id) {
          setCurrentRepo(prev => prev ? { ...prev, is_starred: data.starred, stars_count: data.stars_count } : null);
        }
      }
    } catch (error) {
      console.error('Failed to star/unstar repository:', error);
    }
  };

  const handleForkRepo = async (repo: Repository) => {
    try {
      const response = await fetch(`/r/api/repos/${repo.id}/fork`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        alert(`Repository forked as ${data.fork.full_name}`);
        fetchRepositories();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to fork repository');
      }
    } catch (error) {
      console.error('Failed to fork repository:', error);
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/r/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: newRepo.name,
          description: newRepo.description,
          is_private: newRepo.is_private ? 'on' : '',
          language: newRepo.language
        })
      });
      
      if (response.ok) {
        setShowNewRepo(false);
        setNewRepo({ name: '', description: '', is_private: false, language: '' });
        fetchRepositories();
      }
    } catch (error) {
      console.error('Failed to create repository:', error);
    }
  };

  const handleUploadFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles || !currentRepo) return;

    const formData = new FormData();
    formData.append('path', uploadPath);
    Array.from(selectedFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/r/api/repos/${currentRepo.id}/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setShowUpload(false);
        setSelectedFiles(null);
        setUploadPath('');
        fetchRepoFiles(currentRepo.id, currentPath);
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

  // ---- DEFENSIVE filteredRepos ----
  const filteredRepos = Array.isArray(repositories)
    ? repositories.filter(repo =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  if (view === 'repo' && currentRepo) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <Header showSidebarToggle={false} />
        
        {/* Repository Header */}
        <div className="border-b border-gray-900">
          <div className="max-w-7xl mx-auto px-8 py-12">
            <button
              onClick={() => setView('list')}
              className="text-gray-900 hover:text-gray-600 mb-8 flex items-center gap-2 font-light tracking-wider border-none bg-transparent cursor-pointer"
            >
              ← BACK TO REPOSITORIES
            </button>
            
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-6">
                <img
                  src={currentRepo.owner.avatar_url}
                  alt={currentRepo.owner.username}
                  className="w-16 h-16 border border-gray-200"
                />
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-3xl font-light tracking-tight">
                      {currentRepo.owner.username} / {currentRepo.name}
                    </h1>
                    {currentRepo.is_private ? (
                      <Lock className="w-5 h-5 text-gray-500" />
                    ) : (
                      <Globe className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  {currentRepo.description && (
                    <p className="text-gray-600 font-light text-lg">{currentRepo.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleStarRepo(currentRepo)}
                  className={`flex items-center space-x-2 px-6 py-3 border font-light tracking-wider transition-colors cursor-pointer ${
                    currentRepo.is_starred
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Star className={`w-4 h-4 ${currentRepo.is_starred ? 'fill-current' : ''}`} />
                  <span>STAR</span>
                  <span className="bg-gray-100 text-gray-900 px-2 py-1 text-sm">
                    {currentRepo.stars_count}
                  </span>
                </button>

                <button
                  onClick={() => handleForkRepo(currentRepo)}
                  className="flex items-center space-x-2 px-6 py-3 border bg-white text-gray-900 border-gray-300 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                >
                  <GitFork className="w-4 h-4" />
                  <span>FORK</span>
                  <span className="bg-gray-100 px-2 py-1 text-sm">
                    {currentRepo.forks_count}
                  </span>
                </button>

                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>UPLOAD FILES</span>
                </button>
              </div>
            </div>

            {/* Repository Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-gray-200 mt-12">
              {[
                { label: 'Language', value: currentRepo.language, icon: Code },
                { label: 'Commits', value: currentRepo.commits_count.toString(), icon: GitCommit },
                { label: 'Issues', value: currentRepo.issues_count.toString(), icon: AlertCircle },
                { label: 'Updated', value: formatDate(currentRepo.updated_at), icon: Calendar },
                { label: 'Size', value: formatFileSize(currentRepo.size * 1024), icon: FolderOpen },
              ].map((stat, index) => (
                <div key={index} className="bg-white p-6 hover:bg-gray-50">
                  <div className="flex items-center gap-3 mb-3">
                    <stat.icon className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-light text-gray-500 tracking-widest uppercase">
                      {stat.label}
                    </span>
                  </div>
                  <p className="text-lg font-light">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* File Browser */}
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="border border-gray-200 bg-white">
            {/* Path Breadcrumb */}
            {currentPath && (
              <div className="px-8 py-6 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-3 text-sm font-light tracking-wider">
                  <button
                    onClick={() => fetchRepoFiles(currentRepo.id, '')}
                    className="text-gray-900 hover:text-gray-600 border-none bg-transparent cursor-pointer"
                  >
                    {currentRepo.name}
                  </button>
                  {currentPath.split('/').map((segment, index, array) => (
                    <React.Fragment key={index}>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <button
                        onClick={() => {
                          const path = array.slice(0, index + 1).join('/');
                          fetchRepoFiles(currentRepo.id, path);
                        }}
                        className="text-gray-900 hover:text-gray-600 border-none bg-transparent cursor-pointer"
                      >
                        {segment}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* File List */}
            <div className="divide-y divide-gray-100">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between px-8 py-6 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    {file.type === 'dir' ? (
                      <FolderOpen className="w-5 h-5 text-gray-500" />
                    ) : (
                      <File className="w-5 h-5 text-gray-400" />
                    )}
                    <button
                      onClick={() => {
                        if (file.type === 'dir') {
                          fetchRepoFiles(currentRepo.id, file.path);
                        } else {
                          window.open(`/r/${currentRepo.full_name}/raw/${file.path}`, '_blank');
                        }
                      }}
                      className="text-gray-900 hover:text-gray-600 font-light tracking-wider border-none bg-transparent cursor-pointer"
                    >
                      {file.name}
                    </button>
                  </div>
                  <div className="flex items-center space-x-6 text-sm font-light text-gray-500">
                    {file.size !== undefined && (
                      <span className="tracking-wider">{formatFileSize(file.size)}</span>
                    )}
                    {file.type === 'file' && (
                      <a
                        href={`/r/${currentRepo.full_name}/download/${file.path}`}
                        className="text-gray-900 hover:text-gray-600"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {files.length === 0 && !loading && (
                <div className="px-8 py-16 text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 font-light tracking-wider">This directory is empty</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
            <div className="bg-white border border-gray-200 p-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-light tracking-wider">Upload Files</h3>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-gray-500 hover:text-gray-700 border-none bg-transparent cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUploadFiles}>
                <div className="mb-6">
                  <label className="block text-sm font-light text-gray-500 tracking-widest uppercase mb-3">
                    Destination Path
                  </label>
                  <input
                    type="text"
                    value={uploadPath}
                    onChange={(e) => setUploadPath(e.target.value)}
                    placeholder="folder/subfolder/"
                    className="w-full px-4 py-3 border border-gray-300 bg-white font-light tracking-wider focus:border-gray-900 outline-none"
                  />
                </div>
                <div className="mb-8">
                  <label className="block text-sm font-light text-gray-500 tracking-widest uppercase mb-3">
                    Select Files
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => setSelectedFiles(e.target.files)}
                    className="w-full px-4 py-3 border border-gray-300 bg-white font-light tracking-wider focus:border-gray-900 outline-none"
                  />
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowUpload(false)}
                    className="px-6 py-3 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedFiles}
                    className="px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-light tracking-wider transition-colors border-none cursor-pointer"
                  >
                    UPLOAD
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header showSidebarToggle={false} />
      
      {/* Repository List Header */}
      <div className="border-b border-gray-900">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                Code Management
              </p>
              <h1 className="text-4xl font-light tracking-tight">Repositories</h1>
              <p className="text-lg font-light text-gray-600 mt-2">
                Manage your code repositories and projects
              </p>
            </div>
            <button
              onClick={() => setShowNewRepo(true)}
              className="flex items-center space-x-2 px-8 py-4 bg-gray-900 text-white hover:bg-gray-800 font-light tracking-wider transition-colors border-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>NEW REPOSITORY</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Find a repository..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 bg-white font-light tracking-wider focus:border-gray-900 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Repository List */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-light tracking-wider">Loading repositories...</p>
          </div>
        ) : (
          <div className="space-y-px bg-gray-200">
            {filteredRepos.map((repo) => (
              <div key={repo.id} className="bg-white p-8 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <button
                        onClick={() => {
                          setCurrentRepo(repo);
                          setView('repo');
                          fetchRepoFiles(repo.id);
                        }}
                        className="text-xl font-light text-gray-900 hover:text-gray-600 tracking-wider border-none bg-transparent cursor-pointer"
                      >
                        {repo.name}
                      </button>
                      {repo.is_private ? (
                        <Lock className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Globe className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    
                    {repo.description && (
                      <p className="text-gray-600 font-light mb-4">{repo.description}</p>
                    )}

                    <div className="flex items-center space-x-8 text-sm font-light text-gray-500 tracking-wider">
                      {repo.language && (
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-gray-900 rounded-full"></div>
                          <span>{repo.language}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4" />
                        <span>{repo.stars_count}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <GitFork className="w-4 h-4" />
                        <span>{repo.forks_count}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <AlertCircle className="w-4 h-4" />
                        <span>{repo.issues_count}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>Updated {formatDate(repo.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 ml-8">
                    <button
                      onClick={() => handleStarRepo(repo)}
                      className={`flex items-center space-x-1 px-4 py-2 text-sm font-light tracking-wider transition-colors cursor-pointer ${
                        repo.is_starred
                          ? 'bg-gray-900 text-white border border-gray-900'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Star className={`w-3 h-3 ${repo.is_starred ? 'fill-current' : ''}`} />
                      <span>STAR</span>
                    </button>
                
                    <button
                      onClick={() => handleForkRepo(repo)}
                      className="flex items-center space-x-1 px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                    >
                      <GitFork className="w-3 h-3" />
                      <span>FORK</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredRepos.length === 0 && !loading && (
              <div className="bg-white p-16 text-center">
                <FolderOpen className="w-16 h-16 mx-auto mb-6 text-gray-300" />
                <h3 className="text-xl font-light tracking-wider mb-3">No repositories found</h3>
                <p className="text-gray-500 font-light tracking-wider mb-8">
                  {searchTerm 
                    ? 'Try adjusting your search terms' 
                    : 'Create your first repository to get started'
                  }
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setShowNewRepo(true)}
                    className="flex items-center space-x-2 px-8 py-4 bg-gray-900 text-white hover:bg-gray-800 font-light tracking-wider transition-colors mx-auto border-none cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>CREATE REPOSITORY</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Repository Modal */}
      {showNewRepo && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 p-8 w-full max-w-lg">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-light tracking-wider">Create New Repository</h3>
              <button
                onClick={() => setShowNewRepo(false)}
                className="text-gray-500 hover:text-gray-700 border-none bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateRepo}>
              <div className="mb-6">
                <label className="block text-sm font-light text-gray-500 tracking-widest uppercase mb-3">
                  Repository Name *
                </label>
                <input
                  type="text"
                  value={newRepo.name}
                  onChange={(e) => setNewRepo({ ...newRepo, name: e.target.value })}
                  placeholder="my-awesome-project"
                  required
                  className="w-full px-4 py-3 border border-gray-300 bg-white font-light tracking-wider focus:border-gray-900 outline-none"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-light text-gray-500 tracking-widest uppercase mb-3">
                  Description
                </label>
                <textarea
                  value={newRepo.description}
                  onChange={(e) => setNewRepo({ ...newRepo, description: e.target.value })}
                  placeholder="A short description of your project"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 bg-white font-light tracking-wider focus:border-gray-900 outline-none resize-none"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-light text-gray-500 tracking-widest uppercase mb-3">
                  Primary Language
                </label>
                <select
                  value={newRepo.language}
                  onChange={(e) => setNewRepo({ ...newRepo, language: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 bg-white font-light tracking-wider focus:border-gray-900 outline-none"
                >
                  <option value="">Select Language</option>
                  <option value="JavaScript">JavaScript</option>
                  <option value="TypeScript">TypeScript</option>
                  <option value="Python">Python</option>
                  <option value="Java">Java</option>
                  <option value="C++">C++</option>
                  <option value="C#">C#</option>
                  <option value="Go">Go</option>
                  <option value="Rust">Rust</option>
                  <option value="PHP">PHP</option>
                  <option value="Ruby">Ruby</option>
                  <option value="Swift">Swift</option>
                  <option value="Kotlin">Kotlin</option>
                  <option value="HTML">HTML</option>
                  <option value="CSS">CSS</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="mb-8">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRepo.is_private}
                    onChange={(e) => setNewRepo({ ...newRepo, is_private: e.target.checked })}
                    className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                  />
                  <div>
                    <span className="text-sm font-light text-gray-900 tracking-wider">Private Repository</span>
                    <p className="text-xs text-gray-500 font-light tracking-wider">
                      Only you can see this repository
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowNewRepo(false)}
                  className="px-6 py-3 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-light tracking-wider transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={!newRepo.name.trim()}
                  className="px-6 py-3 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-light tracking-wider transition-colors border-none cursor-pointer"
                >
                  CREATE REPOSITORY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepositoryComponent;
