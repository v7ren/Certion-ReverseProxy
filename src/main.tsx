import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import IndexPage from './pages/index.tsx'
import Dashboard from './pages/dashboard.tsx'
import Login from './pages/login.tsx'
import Profile from './pages/profile.tsx'
import RepositoryComponent from './pages/repo.tsx' // Your existing component
import RepoView from './pages/repo-view.tsx' // New component for individual repo
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/repo" element={<RepositoryComponent />} />
        <Route path="/r/:username/:reponame" element={<RepoView />} />
        <Route path="/r/:username/:reponame/tree/*" element={<RepoView />} />
        <Route path="/r/:username/:reponame/settings" element={<RepoView />} />
        <Route path="/r/new" element={<RepositoryComponent />} />
        {/* Add the new firewall manager route */}
      </Routes>
    </Router>
  </React.StrictMode>,
)