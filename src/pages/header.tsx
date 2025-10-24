// header.tsx
import { useState, useEffect } from 'react';
import { 
  Menu, Search, Bell, ChevronDown, User, Settings, LogOut,
  Terminal
} from 'lucide-react';

type User = {
  username: string;
  email: string;
  avatar_url?: string;
};

interface HeaderProps {
  onMenuToggle?: () => void;
  showSidebarToggle?: boolean;
  user?: User | null;
  onLogout?: () => void;
}

const Header = ({ onMenuToggle, showSidebarToggle = true, user: propUser, onLogout }: HeaderProps) => {
  const [user, setUser] = useState<User | null>(propUser || null);
  const [loading, setLoading] = useState(!propUser);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (!propUser) {
      fetch('/api/auth/me', { credentials: 'include' })
        .then(res => {
          if (!res.ok) throw new Error('Not logged in');
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
    } else {
      setUser(propUser);
      setLoading(false);
    }
  }, [propUser]);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
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
    }
  };

  // Helper function to get avatar URL
  const getAvatarUrl = () => {
    if (!user?.avatar_url) {
      return '/static/uploads/default.png';
    }
    
    // If it's already a full path, use it
    if (user.avatar_url.startsWith('/static/')) {
      return user.avatar_url;
    }
    
    // If it's just the filename, construct the path
    return `/static/uploads/${user.avatar_url}`;
  };

  return (
    <>
      <style>{`
        @import url('/anurati.css');
        .anurati { font-family: 'Anurati', sans-serif; }
        
        /* ===== Header Fixed - Minimalist ===== */
        .header-fixed {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          height: 64px;
        }

        .header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          padding: 0 1.5rem;
          max-width: 100%;
        }

        /* ===== Left Section ===== */
        .header-left {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .header-menu-btn {
          padding: 0.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-menu-btn:hover {
          background: #fafafa;
        }

        @media (min-width: 768px) {
          .header-menu-btn {
            display: none;
          }
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-brand-text {
          font-size: 1.125rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #111827;
        }

        /* ===== Search Bar - Minimalist ===== */
        .header-search {
          display: none;
          flex: 1;
          max-width: 600px;
          margin: 0 3rem;
        }

        @media (min-width: 768px) {
          .header-search {
            display: flex;
          }
        }

        .header-search-wrapper {
          position: relative;
          width: 100%;
        }

        .header-search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
        }

        .header-search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.75rem;
          border: 1px solid #e5e7eb;
          background: #fafafa;
          font-size: 0.875rem;
          font-weight: 300;
          color: #111827;
          outline: none;
          transition: all 0.2s;
          letter-spacing: 0.01em;
        }

        .header-search-input::placeholder {
          color: #9ca3af;
          font-weight: 300;
        }

        .header-search-input:focus {
          background: white;
          border-color: #111827;
        }

        /* ===== Right Section ===== */
        .header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-icon-btn {
          position: relative;
          padding: 0.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon-btn:hover {
          background: #fafafa;
        }

        .header-notification-badge {
          position: absolute;
          top: 0.375rem;
          right: 0.375rem;
          width: 0.5rem;
          height: 0.5rem;
          background: #111827;
        }

        /* ===== User Menu - Minimalist ===== */
        .header-user-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.2s;
        }

        .header-user-btn:hover {
          background: #fafafa;
        }

        .header-user-avatar {
          width: 2rem;
          height: 2rem;
          object-fit: cover;
          border: 1px solid #e5e7eb;
          border-radius: 9999px;
        }

        .header-user-name {
          display: none;
          font-size: 0.875rem;
          font-weight: 400;
          color: #111827;
          letter-spacing: 0.01em;
        }

        @media (min-width: 768px) {
          .header-user-name {
            display: block;
          }
        }

        .header-user-chevron {
          display: none;
          color: #9ca3af;
        }

        @media (min-width: 768px) {
          .header-user-chevron {
            display: block;
          }
        }

        /* ===== Dropdown Menu - Clean ===== */
        .header-dropdown-overlay {
          position: fixed;
          inset: 0;
          z-index: 40;
        }

        .header-dropdown {
          position: absolute;
          right: 0;
          margin-top: 0.5rem;
          width: 240px;
          background: white;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          border: 1px solid #e5e7eb;
          z-index: 50;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .header-dropdown-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f3f4f6;
        }

        .header-dropdown-username {
          font-size: 0.875rem;
          font-weight: 500;
          color: #111827;
          letter-spacing: 0.01em;
        }

        .header-dropdown-email {
          font-size: 0.75rem;
          color: #9ca3af;
          font-weight: 300;
          margin-top: 0.125rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .header-dropdown-menu {
          padding: 0.5rem 0;
        }

        .header-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1.25rem;
          border: none;
          background: transparent;
          color: #6b7280;
          font-size: 0.875rem;
          font-weight: 400;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.01em;
        }

        .header-dropdown-item:hover {
          background: #fafafa;
          color: #111827;
        }

        .header-dropdown-item.logout {
          color: #111827;
          border-top: 1px solid #f3f4f6;
          margin-top: 0.5rem;
          padding-top: 1rem;
        }

        .header-dropdown-item.logout:hover {
          background: #111827;
          color: white;
        }

        .header-dropdown-icon {
          width: 1rem;
          height: 1rem;
          flex-shrink: 0;
        }

        /* ===== Loading State ===== */
        .header-loading {
          width: 2rem;
          height: 2rem;
          background: #f3f4f6;
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          border-radius: 9999px;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

      <header className="header-fixed">
        <div className="header-container">
          {/* Left Section */}
          <div className="header-left">
            {showSidebarToggle && (
              <button
                onClick={onMenuToggle}
                className="header-menu-btn"
                aria-label="Toggle menu"
              >
                <Menu className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
              </button>
            )}
            
            <div className="header-brand">
              <Terminal className="w-7 h-7 text-gray-900" strokeWidth={1.5} />
              <span className="anurati header-brand-text">CERTION</span>
            </div>
          </div>

          {/* Search Bar - Hidden on mobile */}
          <div className="header-search">
            <div className="header-search-wrapper">
              <Search className="header-search-icon w-4 h-4" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search projects, agents, or commands..."
                className="header-search-input"
              />
            </div>
          </div>

          {/* Right Section */}
          <div className="header-right">
            {/* Notifications */}
            <button className="header-icon-btn" aria-label="Notifications">
              <Bell className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
              <span className="header-notification-badge"></span>
            </button>

            {/* User Menu */}
            {loading ? (
              <div className="header-loading"></div>
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="header-user-btn"
                  aria-label="User menu"
                >
                  <img 
                    src={getAvatarUrl()}
                    alt={user.username} 
                    className="header-user-avatar"
                    onError={(e) => {
                      e.currentTarget.src = '/static/uploads/default.png';
                    }}
                  />
                  <span className="header-user-name">
                    {user.username}
                  </span>
                  <ChevronDown className="header-user-chevron w-4 h-4" strokeWidth={1.5} />
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div 
                      className="header-dropdown-overlay" 
                      onClick={() => setShowUserMenu(false)}
                    ></div>
                    <div className="header-dropdown">
                      <div className="header-dropdown-header">
                        <p className="header-dropdown-username">{user.username}</p>
                        <p className="header-dropdown-email">{user.email}</p>
                      </div>
                      
                      <div className="header-dropdown-menu">
                        <button 
                          onClick={() => {
                            window.location.href = '/profile';
                            setShowUserMenu(false);
                          }}
                          className="header-dropdown-item"
                        >
                          <User className="header-dropdown-icon" strokeWidth={1.5} />
                          <span>Profile</span>
                        </button>
                        
                        <button 
                          onClick={() => {
                            window.location.href = '/settings';
                            setShowUserMenu(false);
                          }}
                          className="header-dropdown-item"
                        >
                          <Settings className="header-dropdown-icon" strokeWidth={1.5} />
                          <span>Settings</span>
                        </button>
                        
                        <button 
                          onClick={handleLogout}
                          className="header-dropdown-item logout"
                        >
                          <LogOut className="header-dropdown-icon" strokeWidth={1.5} />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
