// nav.tsx
import { useState, useMemo } from 'react';
import {
  X, Shield, Home, FolderOpen, Award,
  BarChart3, ChevronRight, FileText, Layers, Bookmark, Terminal,
  HelpCircle, LogOut, User, Cpu, Wifi, Settings,
  ChevronDown, Code, Activity
} from 'lucide-react';

// Types
type User = {
  username: string;
  email: string;
  avatar_url?: string;
};

type Agent = {
  id: number;
  name: string;
  status: 'online' | 'offline';
  last_heartbeat: string | null;
  system_info: any;
  created_at: string;
};

type NavigationItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  badge?: string | number;
  highlight?: boolean;
};

type NavigationCategory = {
  category: string;
  items: NavigationItem[];
  color?: 'default' | 'primary' | 'success' | 'warning';
};

interface NavProps {
  sidebarOpen: boolean;
  activeTab: string;
  user: User | null;
  projectsCount: number;
  agents: Agent[];
  onClose: () => void;
  onTabClick: (tab: string) => void;
  onLogout: () => void;
}

const Nav = ({
  sidebarOpen,
  activeTab,
  user,
  projectsCount,
  agents,
  onClose,
  onTabClick,
  onLogout
}: NavProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Main', 'Agents', 'Security', 'Tools'])
  );

  // Computed values
  const onlineAgents = useMemo(
    () => agents.filter(a => a.status === 'online').length,
    [agents]
  );

  const navigationItems: NavigationCategory[] = useMemo(() => [
    {
      category: 'Main',
      color: 'default',
      items: [
        { id: 'dashboard', icon: Home, label: 'Dashboard' },
        { id: 'projects', icon: FolderOpen, label: 'My Projects', badge: projectsCount },
        { id: 'repositories', icon: Code, label: 'Repositories' },
        { id: 'activity', icon: Activity, label: 'Activity Feed', badge: '3' },
      ]
    },
    {
      category: 'Agents',
      color: 'primary',
      items: [
        { id: 'agents', icon: Cpu, label: 'All Agents', badge: agents.length, highlight: true },
        { id: 'agent-status', icon: Wifi, label: 'Agent Status' },
        { id: 'agent-logs', icon: Terminal, label: 'Agent Logs' },
        { id: 'agent-settings', icon: Settings, label: 'Agent Settings' },
      ]
    },
    {
      category: 'Security',
      color: 'success',
      items: [
        { id: 'certificates', icon: Award, label: 'Certificates', badge: '8' },
        { id: 'compliance', icon: Terminal, label: 'Compliance' },
        { id: 'analytics', icon: BarChart3, label: 'Analytics' },
      ]
    },
    {
      category: 'Tools',
      color: 'warning',
      items: [
        { id: 'documentation', icon: FileText, label: 'Documentation' },
        { id: 'templates', icon: Layers, label: 'Templates' },
        { id: 'bookmarks', icon: Bookmark, label: 'Bookmarks', badge: '12' },
      ]
    }
  ], [projectsCount, agents.length]);

  // Handlers
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleNavItemClick = (itemId: string) => {
    onTabClick(itemId);
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      <style>{`
        /* ===== Base Sidebar Styles - Minimalist Design ===== */
        .nav-sidebar {
          position: fixed;
          top: 64px;
          bottom: 0;
          left: 0;
          z-index: 40;
          display: flex;
          flex-direction: column;
          background: white;
          border-right: 1px solid #e5e7eb;
          width: 280px;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Mobile overlay behavior */
        @media (max-width: 767px) {
          .nav-sidebar {
            transform: translateX(-100%);
            box-shadow: none;
          }

          .nav-sidebar.open {
            transform: translateX(0);
            box-shadow: 4px 0 24px rgba(0, 0, 0, 0.08);
          }
        }

        /* Desktop always visible */
        @media (min-width: 768px) {
          .nav-sidebar {
            transform: translateX(0) !important;
          }
        }

        /* ===== Overlay ===== */
        .nav-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.15);
          z-index: 30;
          backdrop-filter: blur(2px);
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (min-width: 768px) {
          .nav-overlay {
            display: none !important;
          }
        }

        /* ===== Header - Minimalist ===== */
        .nav-header {
          flex-shrink: 0;
          padding: 2rem 1.5rem;
          border-bottom: 1px solid #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav-logo-container {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .nav-logo {
          width: 2rem;
          height: 2rem;
          background: #111827;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nav-brand {
          display: flex;
          flex-direction: column;
        }

        .nav-brand-title {
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
          line-height: 1;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .nav-brand-subtitle {
          font-size: 0.625rem;
          color: #9ca3af;
          font-weight: 300;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-top: 0.25rem;
        }

        .nav-close-btn {
          padding: 0.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nav-close-btn:hover {
          background: #f9fafb;
        }

        @media (min-width: 768px) {
          .nav-close-btn {
            display: none;
          }
        }

        /* ===== Scroll Area ===== */
        .nav-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1.5rem 1rem;
          scrollbar-width: thin;
          scrollbar-color: #e5e7eb transparent;
        }

        .nav-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .nav-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .nav-scroll::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 2px;
        }

        .nav-scroll::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }

        /* ===== Category - Clean & Minimal ===== */
        .nav-category {
          margin-bottom: 2rem;
        }

        .nav-category:last-child {
          margin-bottom: 0;
        }

        .nav-category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.75rem;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.2s;
        }

        .nav-category-header:hover {
          background: transparent;
        }

        .nav-category-title {
          font-size: 0.625rem;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #9ca3af;
        }

        .nav-category-icon {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: #d1d5db;
          width: 14px;
          height: 14px;
        }

        .nav-category-icon.expanded {
          transform: rotate(180deg);
        }

        /* ===== Category Content ===== */
        .nav-category-content {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .nav-category-content.expanded {
          grid-template-rows: 1fr;
        }

        .nav-category-inner {
          overflow: hidden;
        }

        .nav-items {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        /* ===== Navigation Items - Minimalist Style ===== */
        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.875rem 0.75rem;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: #6b7280;
          font-size: 0.875rem;
          font-weight: 400;
          text-align: left;
          letter-spacing: 0.01em;
        }

        .nav-item:hover {
          background: #fafafa;
          color: #111827;
        }

        .nav-item.active {
          background: #111827;
          color: white;
        }

        .nav-item.active:hover {
          background: #1f2937;
        }

        .nav-item-content {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          min-width: 0;
          flex: 1;
        }

        .nav-item-icon {
          flex-shrink: 0;
          width: 1.125rem;
          height: 1.125rem;
        }

        .nav-item-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 300;
        }

        .nav-item.active .nav-item-label {
          font-weight: 400;
        }

        .nav-item-end {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .nav-item-badge {
          padding: 0.125rem 0.5rem;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 0.6875rem;
          font-weight: 500;
          min-width: 1.5rem;
          text-align: center;
          letter-spacing: 0.02em;
        }

        .nav-item.active .nav-item-badge {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }

        .nav-item-arrow {
          width: 0.875rem;
          height: 0.875rem;
          color: #d1d5db;
        }

        .nav-item.active .nav-item-arrow {
          color: rgba(255, 255, 255, 0.6);
        }

        /* ===== Footer - Minimal ===== */
        .nav-footer {
          flex-shrink: 0;
          padding: 1.5rem 1rem;
          border-top: 1px solid #f3f4f6;
        }

        .nav-user-card {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 1rem;
          background: #fafafa;
          margin-bottom: 0.75rem;
          transition: background 0.2s;
        }

        .nav-user-card:hover {
          background: #f5f5f5;
        }

        .nav-user-avatar {
          width: 2.5rem;
          height: 2.5rem;
          background: #111827;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
          font-size: 0.875rem;
          flex-shrink: 0;
          letter-spacing: 0.05em;
        }

        .nav-user-info {
          flex: 1;
          min-width: 0;
        }

        .nav-user-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.01em;
        }

        .nav-user-email {
          font-size: 0.6875rem;
          color: #9ca3af;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 300;
          margin-top: 0.125rem;
        }

        .nav-footer-actions {
          display: flex;
          gap: 0.5rem;
        }

        .nav-footer-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          background: white;
          color: #6b7280;
          font-size: 0.75rem;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .nav-footer-btn:hover {
          background: #fafafa;
          border-color: #d1d5db;
          color: #111827;
        }

        .nav-footer-btn.logout {
          color: #111827;
          border-color: #e5e7eb;
        }

        .nav-footer-btn.logout:hover {
          background: #111827;
          border-color: #111827;
          color: white;
        }

        /* ===== Status Indicator - Monochrome ===== */
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: #fafafa;
          border: 1px solid #f3f4f6;
          margin-bottom: 1.5rem;
        }

        .status-dot {
          width: 0.5rem;
          height: 0.5rem;
          background: #111827;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }

        .status-text {
          font-size: 0.75rem;
          font-weight: 400;
          color: #6b7280;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .status-count {
          margin-left: auto;
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
          letter-spacing: 0.02em;
        }
      `}</style>

      {/* Overlay for mobile only */}
      {sidebarOpen && <div className="nav-overlay" onClick={onClose} />}

      {/* Sidebar */}
      <aside className={`nav-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="nav-header">
          <div className="nav-logo-container">
            <div className="nav-logo">
              <Shield size={18} color="white" strokeWidth={2} />
            </div>
            <div className="nav-brand">
              <div className="nav-brand-title">Certion</div>
              <div className="nav-brand-subtitle">Platform</div>
            </div>
          </div>
          <button className="nav-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Scroll Area */}
        <div className="nav-scroll">
          {/* Status Indicator */}
          <div className="status-indicator">
            <div className="status-dot" />
            <span className="status-text">Agents</span>
            <span className="status-count">{onlineAgents}/{agents.length}</span>
          </div>

          {/* Navigation Categories */}
          {navigationItems.map((category) => {
            const isExpanded = expandedCategories.has(category.category);
            
            return (
              <div key={category.category} className="nav-category">
                <button
                  className="nav-category-header"
                  onClick={() => toggleCategory(category.category)}
                >
                  <span className="nav-category-title">{category.category}</span>
                  <ChevronDown 
                    className={`nav-category-icon ${isExpanded ? 'expanded' : ''}`}
                  />
                </button>

                <div className={`nav-category-content ${isExpanded ? 'expanded' : ''}`}>
                  <div className="nav-category-inner">
                    <div className="nav-items">
                      {category.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;

                        return (
                          <button
                            key={item.id}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => handleNavItemClick(item.id)}
                          >
                            <div className="nav-item-content">
                              <Icon className="nav-item-icon" strokeWidth={1.5} />
                              <span className="nav-item-label">{item.label}</span>
                            </div>
                            <div className="nav-item-end">
                              {item.badge && (
                                <span className="nav-item-badge">{item.badge}</span>
                              )}
                              <ChevronRight className="nav-item-arrow" strokeWidth={1.5} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="nav-footer">
          {user && (
            <div className="nav-user-card">
              <div className="nav-user-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="nav-user-info">
                <div className="nav-user-name">{user.username}</div>
                <div className="nav-user-email">{user.email}</div>
              </div>
            </div>
          )}

          <div className="nav-footer-actions">
            <button className="nav-footer-btn">
              <HelpCircle size={14} strokeWidth={2} />
              <span>Help</span>
            </button>
            <button className="nav-footer-btn logout" onClick={onLogout}>
              <LogOut size={14} strokeWidth={2} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Nav;
