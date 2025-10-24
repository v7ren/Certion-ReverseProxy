import { useState } from 'react';
import { 
  Menu, 
  X, 
  Shield, 
  Search, 
  Bell, 
  ChevronDown, 
  Home, 
  FolderOpen, 
  Award, 
  BarChart3, 
  Settings, 
  ChevronRight, 
  Plus, 
  Github, 
  ArrowUpRight, 
  GitCommit, 
  Zap, 
  Clock 
} from 'lucide-react';

const CertionDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-900 bg-white sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <button 
              onClick={toggleSidebar}
              className="md:hidden p-2 hover:bg-gray-100 border-none bg-transparent cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4">
              <Shield className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-light tracking-wider font-mono">
                  CERTION
                </h1>
                <p className="text-xs font-light text-gray-500 tracking-widest uppercase">
                  Trust & Security Platform
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search projects, certificates..." 
                className="border border-gray-300 py-3 px-4 pl-12 w-80 bg-white outline-none focus:border-gray-900 rounded-none"
              />
            </div>
            <button className="relative p-2 hover:bg-gray-50 border-none bg-transparent cursor-pointer">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-light">
                3
              </span>
            </button>
            <button className="flex items-center gap-3 p-2 hover:bg-gray-50 border-none bg-transparent cursor-pointer">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                <span>User</span>
              </div>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-20 z-30 md:hidden"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar */}
        <aside className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:static top-0 bottom-0 left-0 z-40 w-80 bg-white border-r border-gray-200 transition-transform duration-300`}>
          <div className="p-8">
            <button 
              onClick={closeSidebar}
              className="md:hidden absolute top-6 right-6 p-1 hover:bg-gray-100 border-none bg-transparent cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <nav className="mt-8">
              <ul className="list-none p-0 m-0">
                {[
                  { id: 'dashboard', icon: Home, label: 'Dashboard' },
                  { id: 'projects', icon: FolderOpen, label: 'My Projects' },
                  { id: 'certificates', icon: Award, label: 'Certificates' },
                  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
                  { id: 'settings', icon: Settings, label: 'Settings' },
                ].map((item) => (
                  <li key={item.id} className="mb-1">
                    <button 
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full flex items-center justify-between p-4 text-left transition-all border-none cursor-pointer ${
                        activeTab === item.id 
                          ? 'bg-gray-900 text-white' 
                          : 'text-gray-700 hover:bg-gray-50 bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <item.icon className="w-5 h-5" />
                        <span className="font-light tracking-wider">{item.label}</span>
                      </div>
                      {activeTab === item.id && <ChevronRight className="w-4 h-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 md:p-12">
          {/* Welcome Section */}
          <div className="mb-16">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
              <div>
                <p className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                  Welcome Back
                </p>
                <h2 className="text-4xl font-light mb-4 tracking-tight">Dashboard Overview</h2>
                <p className="text-lg font-light text-gray-700 max-w-md">
                  Monitor your projects, certificates, and security metrics.
                </p>
              </div>
              <div className="flex flex-col gap-4 mt-8 lg:mt-0">
                <button className="bg-gray-900 text-white py-4 px-8 hover:bg-gray-800 font-light tracking-wider flex items-center gap-2 border-none cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span>NEW PROJECT</span>
                </button>
                <button className="border border-gray-300 bg-white text-gray-900 py-4 px-8 hover:bg-gray-50 font-light tracking-wider flex items-center gap-2 cursor-pointer">
                  <Github className="w-4 h-4" />
                  <span>IMPORT FROM GITHUB</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200 mb-16">
            {[
              { title: 'Total Projects', number: '12', change: '+2 this month' },
              { title: 'Active Certificates', number: '8', change: '2 expiring soon' },
              { title: 'Trust Score', number: '93', change: '+5 this week' },
              { title: 'Deployments', number: '24', change: '+12 this month' },
            ].map((stat, index) => (
              <div key={index} className="bg-white p-8 hover:bg-gray-50">
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-sm font-light text-gray-500 tracking-widest uppercase mb-2">
                    {stat.title}
                  </h3>
                  <p className="text-4xl font-light">{stat.number}</p>
                </div>
                <p className="text-sm font-light text-gray-500">{stat.change}</p>
              </div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <div className="border border-gray-200 bg-white">
                <div className="border-b border-gray-200 p-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-light tracking-wider">Recent Activity</h3>
                    <button className="text-sm font-light tracking-widest uppercase hover:text-gray-500 flex items-center gap-1 border-none bg-transparent cursor-pointer">
                      <span>View All</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-8">
                  <div className="flex flex-col gap-8">
                    {[
                      {
                        icon: GitCommit,
                        project: 'Web-Security-Tool',
                        status: 'SUCCESS',
                        description: 'Added SSL certificate validation feature',
                        time: '2 hours ago'
                      },
                      {
                        icon: Shield,
                        project: 'API-Gateway',
                        status: 'SUCCESS',
                        description: 'Certificate successfully renewed',
                        time: '4 hours ago'
                      },
                      {
                        icon: Zap,
                        project: 'Mobile-App',
                        status: 'SUCCESS',
                        description: 'Deployed to production environment',
                        time: '1 day ago'
                      }
                    ].map((activity, index) => (
                      <div key={index} className="flex items-start gap-6 pb-8 border-b border-gray-100 last:border-b-0 last:pb-0">
                        <div className="flex-shrink-0 mt-2">
                          <activity.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium tracking-wider">{activity.project}</h4>
                            <span className="text-xs tracking-widest uppercase text-gray-900 font-medium">
                              {activity.status}
                            </span>
                          </div>
                          <p className="text-gray-700 font-light mb-3">{activity.description}</p>
                          <p className="text-xs font-light text-gray-500 tracking-wider flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {activity.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-12">
              {/* Top Projects */}
              <div className="border border-gray-200 bg-white">
                <div className="border-b border-gray-200 p-6">
                  <h3 className="text-xl font-light tracking-wider">Top Projects</h3>
                </div>
                <div className="p-6">
                  <div className="flex flex-col gap-6">
                    {[
                      {
                        indicator: '●',
                        name: 'Web-Security-Tool',
                        status: 'ACTIVE',
                        score: 95,
                        commits: 24,
                        contributors: 3
                      },
                      {
                        indicator: '◆',
                        name: 'API-Gateway',
                        status: 'CERTIFIED',
                        score: 98,
                        commits: 18,
                        contributors: 2
                      }
                    ].map((project, index) => (
                      <div key={index} className="pb-6 border-b border-gray-100 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{project.indicator}</span>
                            <h4 className="font-medium tracking-wider">{project.name}</h4>
                          </div>
                          <span className="text-xs font-light tracking-widest uppercase text-gray-500">
                            {project.status}
                          </span>
                        </div>
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-light text-gray-500 tracking-widest uppercase">
                              Trust Score
                            </span>
                            <span className="text-lg font-light">{project.score}%</span>
                          </div>
                          <div className="w-full border border-gray-200 h-px">
                            <div 
                              className="bg-gray-900 h-px transition-all duration-300"
                              style={{ width: `${project.score}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs font-light text-gray-500 tracking-wider">
                          <span>{project.commits} commits</span>
                          <span>{project.contributors} contributors</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trust Score */}
              <div className="border border-gray-200 bg-white p-8 text-center">
                <div className="mb-6">
                  <div className="w-24 h-24 border-2 border-gray-900 mx-auto mb-4 flex items-center justify-center">
                    <span className="text-3xl font-light">93</span>
                  </div>
                  <h3 className="text-lg font-light tracking-wider mb-2">Overall Trust Score</h3>
                  <p className="text-sm font-light text-gray-500 tracking-wider">
                    Excellent security rating
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200">
                  <div>
                    <p className="text-2xl font-light mb-1">A+</p>
                    <p className="text-xs font-light text-gray-500 tracking-widest uppercase">
                      Security
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-light mb-1">100%</p>
                    <p className="text-xs font-light text-gray-500 tracking-widest uppercase">
                      Compliance
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CertionDashboard;