import React from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import axios from 'axios';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import CreateContainer from './pages/CreateContainer';
import ViewContainers from './pages/ViewContainers';
import Networks from './pages/Networks';
import Buckets from './pages/Buckets';
import Snapshots from './pages/Snapshots';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import OrganizationDashboard from './pages/OrganizationDashboard';
import Plans from './pages/Plans';
import GitDeploy from './pages/GitDeploy';
import Volumes from './pages/Volumes';
import Secrets from './pages/Secrets';
import Registries from './pages/Registry';
import Marketplace from './pages/Marketplace';
import InviteAccept from './pages/InviteAccept';
import Layout from './components/Layout';
import { ThemeProvider } from './components/ThemeContext';
import { ToastProvider } from './components/ToastContext';
import { OrgProvider, useOrg } from './context/OrgContext';
import { NotificationProvider } from './context/NotificationContext';
import ChatAssistant from './components/ChatAssistant';

// Global Axios config for HTTP-Only Cookies
axios.defaults.withCredentials = true;
axios.defaults.baseURL = '';

// Interceptor to auto-logout on 401 Unauthorized, excluding auth check endpoints
axios.interceptors.response.use(
  response => response,
  error => {
    // If the error comes from /auth/me or login, do not nuke the session globally
    const url = error.config?.url || '';

    if (error.response && error.response.status === 401) {
      if (!url.includes('/auth/me') && !url.includes('/login') && !url.includes('/logout')) {
        localStorage.removeItem('role');
        localStorage.removeItem('name');
        localStorage.removeItem('activeOrgId');
        
        if (window.location.pathname !== '/login') {
          console.warn(`[Axios] Received 401 Unauthorized from ${url}. Logging out to clear invalid session.`);
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Interceptor to append organization context header
axios.interceptors.request.use((config) => {
  const activeOrgId = localStorage.getItem('activeOrgId');
  if (activeOrgId) {
    config.headers['x-organization-id'] = activeOrgId;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

const ProtectedRoute = ({ children }) => {
  return localStorage.getItem('role') ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  return localStorage.getItem('role') ? <Navigate to="/app" /> : children;
};

const PlanRoute = ({ children, requiredLevel }) => {
  const { userPlan } = useOrg();
  const plan = userPlan || 'free';
  const role = localStorage.getItem('role');

  const levels = {
    free: 0,
    hobby: 0,
    professional: 1,
    pro: 1,
    enterprise: 2,
    agency: 3,
    msp: 3,
    partner: 3
  };

  const currentLevel = levels[plan] || 0;
  const reqLevel = levels[requiredLevel] || 0;

  if (role === 'admin') return children;

  if (currentLevel >= reqLevel) {
    return children;
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-[70vh] animate-fade-in">
      <div className="w-20 h-20 bg-brand-500/10 rounded-2xl flex items-center justify-center mb-6 border border-brand-500/20 shadow-sm text-brand-500">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      </div>
      <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">Feature Locked</h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
        This feature requires the <strong>{requiredLevel.charAt(0).toUpperCase() + requiredLevel.slice(1)}</strong> plan or higher. Upgrade your workspace to unlock advanced tools and scale your infrastructure.
      </p>

      <NavLink
        to="/app/plans"
        className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
      >
        View Plans & Upgrade
      </NavLink>
    </div>
  );
};

const App = () => {

  return (
    <ThemeProvider>
      <ToastProvider>
        <OrgProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/" element={<PublicRoute><Welcome /></PublicRoute>} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/invite/:token" element={<InviteAccept />} />

              {/* Protected Routes */}
              <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="create" element={<CreateContainer />} />
                <Route path="git-deploy" element={<GitDeploy />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="containers" element={<ViewContainers />} />
                <Route path="secrets" element={<PlanRoute requiredLevel="professional"><Secrets /></PlanRoute>} />
                <Route path="registries" element={<PlanRoute requiredLevel="enterprise"><Registries /></PlanRoute>} />
                <Route path="volumes" element={<Volumes />} />
                <Route path="networks" element={<Networks />} />
                <Route path="snapshots" element={<PlanRoute requiredLevel="professional"><Snapshots /></PlanRoute>} />
                <Route path="admin" element={<AdminDashboard />} />
                <Route path="organization" element={<OrganizationDashboard />} />
                <Route path="plans" element={<Plans />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>

            {/* Global Chat Assistant rendered outside of all router layout contexts */}
            <ChatAssistant />
          </NotificationProvider>
        </OrgProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
