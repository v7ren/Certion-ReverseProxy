import { useState, useEffect } from 'react';
import { User, Edit3, Camera, Mail, MapPin, Calendar } from 'lucide-react';
import Header from './header';
import Nav from './nav';

type UserType = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  location: string;
  website: string;
  created_at: string;
  repository_count: number;
};

type Agent = {
  id: number;
  name: string;
  status: 'online' | 'offline';
  last_heartbeat: string | null;
  system_info: any;
  created_at: string;
};

const UserProfile = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);

  // Fetch user info from Flask API
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = '/login';
            return;
          }
          throw new Error('Failed to fetch user');
        }
        return res.json();
      })
      .then(data => {
        setUser(data.user);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch user:', error);
        setUser(null);
        setLoading(false);
      });
  }, []);

  // Load agents
  useEffect(() => {
    fetch('/api/agents', {
      method: 'GET',
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAgents(data.agents);
        }
      })
      .catch(error => {
        console.error('Failed to load agents:', error);
      });
  }, []);

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      } as const;
      setCurrentDate(now.toLocaleDateString('en-US', options).toUpperCase());
    };
    
    updateDate();
  }, []);

  const handleLogout = async () => {
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
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5MB');
      return;
    }

    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please use PNG, JPG, JPEG, GIF, or WEBP');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setIsUploading(true);

    try {
      const response = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setUser(prev => prev ? {
          ...prev,
          avatar_url: data.avatar_url
        } : null);
        
        alert('Profile picture updated successfully!');
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  // Helper function to get avatar URL
  const getAvatarUrl = () => {
    if (!user?.avatar_url) {
      return '/static/uploads/default.png';
    }
    
    if (user.avatar_url.startsWith('/static/')) {
      return user.avatar_url;
    }
    
    return `/static/uploads/${user.avatar_url}`;
  };

  // Helper function to get display name
  const getDisplayName = () => {
    if (loading) return { firstName: 'Loading', lastName: '...' };
    
    if (!user) return { firstName: 'Not', lastName: 'Logged In' };
    
    const displayName = user.full_name || user.username || 'User';
    const nameParts = displayName.split(/[\s._-]+/);
    
    if (nameParts.length >= 2) {
      return {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ')
      };
    }
    return {
      firstName: displayName,
      lastName: ''
    };
  };

  // Helper function to get email
  const getEmail = () => {
    if (loading) return 'loading@certion.dev';
    if (!user) return 'guest@certion.dev';
    return user.email || `${user.username}@certion.dev`;
  };

  // Helper function to get join date
  const getJoinDate = () => {
    if (loading || !user?.created_at) return 'Joined March 2024';
    
    try {
      const date = new Date(user.created_at);
      const options = { year: 'numeric', month: 'long' } as const;
      return `Joined ${date.toLocaleDateString('en-US', options)}`;
    } catch {
      return 'Joined March 2024';
    }
  };

  const { firstName, lastName } = getDisplayName();

  return (
    <>
      {/* Global Styles */}
      <style>{`
        @import url('/anurati.css');
        
        .anurati {
          font-family: 'Anurati', sans-serif;
        }
        
        .profile-header {
          animation: fadeInUp 1.2s ease-out;
        }
        
        .profile-content {
          animation: fadeInUp 1.4s ease-out;
        }
        
        .stats-section {
          animation: fadeInUp 1.6s ease-out;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .writing-mode-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }

        .avatar-upload-overlay {
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .avatar-container:hover .avatar-upload-overlay {
          opacity: 1;
        }

        .spinner {
          border: 2px solid #f3f3f3;
          border-top: 2px solid #333;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .avatar-loading {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }
        
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .main-content {
          min-height: 100vh;
          padding-top: 64px;
          transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.6, 1);
        }

        @media (min-width: 768px) {
          .main-content {
            margin-left: 280px;
          }
        }

        @media (max-width: 767px) {
          .main-content {
            margin-left: 0 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-white text-black overflow-hidden relative">
        {/* Header */}
        <Header 
          user={user}
          onLogout={handleLogout}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          showSidebarToggle={true}
        />

        {/* Navigation */}
        <Nav
          sidebarOpen={sidebarOpen}
          activeTab="profile"
          user={user}
          projectsCount={0}
          agents={agents}
          onClose={() => setSidebarOpen(false)}
          onTabClick={(tab) => {
            if (tab === 'profile') {
              // Already on profile
            } else {
              window.location.href = '/dashboard';
            }
          }}
          onLogout={handleLogout}
        />

        {/* Fixed Elements */}
        <div className="fixed top-20 right-10 text-xs font-light text-gray-500 tracking-wide uppercase z-40">
          {currentDate}
        </div>
        
        <div className="anurati fixed right-10 top-1/2 transform -translate-y-1/2 writing-mode-vertical text-xs font-normal text-gray-400 tracking-widest uppercase z-40">
          PROFILE
        </div>
        
        <div className="fixed bottom-10 right-10 text-xs font-light text-gray-300 z-40">
          / / /
        </div>

        {/* Geometric Elements */}
        <div className="absolute w-28 h-28 top-[25%] right-[15%] border border-gray-100 pointer-events-none z-10"></div>
        <div className="absolute w-16 h-16 bottom-[40%] left-[20%] border border-gray-100 rounded-full pointer-events-none z-10"></div>
        <div className="absolute w-48 h-px top-[60%] right-[10%] bg-gray-100 pointer-events-none z-10"></div>
        <div className="absolute w-12 h-32 bottom-[20%] right-[25%] border border-gray-100 transform rotate-12 pointer-events-none z-10"></div>

        {/* Main Content */}
        <main className="main-content">
          <div className="max-w-4xl p-10 md:pl-32 md:pr-20 w-full mx-auto">
            
            {/* Profile Header */}
            <div className="anurati text-xs font-normal text-gray-400 tracking-widest uppercase mb-5">
              Your Identity
            </div>
            
            <div className="profile-header flex flex-col md:flex-row items-start gap-12 mb-16">
              <div className="relative avatar-container">
                <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden relative">
                  {loading ? (
                    <div className="w-full h-full avatar-loading rounded-full" />
                  ) : user?.avatar_url ? (
                    <img
                      className="w-full h-full object-cover"
                      src={getAvatarUrl()}
                      alt="Profile Avatar"
                      onError={(e) => {
                        e.currentTarget.src = '/static/uploads/default.png';
                      }}
                    />
                  ) : (
                    <User className="w-16 h-16 text-gray-400" />
                  )}
                  
                  {/* Upload overlay */}
                  {!loading && (
                    <div className="avatar-upload-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full">
                      {isUploading ? (
                        <div className="spinner"></div>
                      ) : (
                        <Camera className="w-8 h-8 text-white" />
                      )}
                    </div>
                  )}
                </div>
                
                {/* File input and camera button */}
                {!loading && (
                  <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-black rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
                    {isUploading ? (
                      <div className="spinner border-white border-t-transparent w-5 h-5"></div>
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <h1 className="text-5xl md:text-6xl font-extralight text-black leading-none tracking-tight">
                    {firstName}
                    {lastName && (
                      <span className="font-semibold block mt-2">{lastName}</span>
                    )}
                  </h1>
                  {!loading && (
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-5 h-5 text-gray-400" />
                    </button>
                  )}
                </div>
                
                <p className="text-lg font-light text-gray-600 leading-tight mb-6 max-w-md">
                  {loading ? 'Loading profile...' : (user?.bio || 'Verified Creator. Code Architect. Security Specialist.')}
                </p>
              </div>
            </div>

            {/* Profile Details */}
            <div className="profile-content grid md:grid-cols-2 gap-12 mb-16">
              <div>
                <div className="anurati text-xs font-normal text-gray-400 tracking-widest uppercase mb-6">
                  Personal Information
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">
                      {getEmail()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">
                      {loading ? 'Loading...' : (user?.location || 'San Francisco, CA')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">{getJoinDate()}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="anurati text-xs font-normal text-gray-400 tracking-widest uppercase mb-6">
                  Specializations
                </div>
                
                <div className="space-y-3">
                  <div className="bg-gray-50 px-4 py-2 text-sm text-gray-700 inline-block mr-2 mb-2">
                    Full-Stack Development
                  </div>
                  <div className="bg-gray-50 px-4 py-2 text-sm text-gray-700 inline-block mr-2 mb-2">
                    React & TypeScript
                  </div>
                  <div className="bg-gray-50 px-4 py-2 text-sm text-gray-700 inline-block mr-2 mb-2">
                    Security Architecture
                  </div>
                  <div className="bg-gray-50 px-4 py-2 text-sm text-gray-700 inline-block mr-2 mb-2">
                    Certificate Management
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Section */}
            <div className="stats-section border-t border-gray-100 pt-12">
              <div className="anurati text-xs font-normal text-gray-400 tracking-widest uppercase mb-8">
                Achievement Overview
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                <div className="text-center">
                  <div className="text-3xl font-light text-black mb-2">
                    {loading ? '...' : (user?.repository_count || '12')}
                  </div>
                  <div className="text-xs font-normal text-gray-400 uppercase tracking-wide">Projects</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-light text-black mb-2">8</div>
                  <div className="text-xs font-normal text-gray-400 uppercase tracking-wide">Certified</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-light text-black mb-2">93</div>
                  <div className="text-xs font-normal text-gray-400 uppercase tracking-wide">Trust Score</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-light text-black mb-2">24</div>
                  <div className="text-xs font-normal text-gray-400 uppercase tracking-wide">Deployments</div>
                </div>
              </div>
              
              {/* Quote Section */}
              <div className="max-w-lg mb-8">
                <div className="text-xs font-normal text-gray-300 tracking-wider uppercase mb-6">
                  Personal Philosophy
                </div>
                
                <blockquote className="text-2xl font-light text-black leading-tight italic mb-5">
                  "Quality code is not just about functionality—it's about trust, security, and lasting impact."
                </blockquote>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-6 flex-col md:flex-row">
                <button className="anurati bg-black text-white border-none py-4 px-8 text-xs font-normal tracking-wider uppercase cursor-pointer transition-all duration-300 hover:bg-gray-700 hover:translate-x-1">
                  Edit Profile
                </button>
                
                <button className="anurati border border-gray-300 text-black bg-transparent py-4 px-8 text-xs font-normal tracking-wider uppercase cursor-pointer transition-all duration-300 hover:bg-gray-50 hover:translate-x-1">
                  View Portfolio
                </button>
              </div>
            </div>
            
          </div>
        </main>
      </div>
    </>
  );
};

export default UserProfile;
