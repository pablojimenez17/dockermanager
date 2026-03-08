import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateContainer from './pages/CreateContainer';
import ViewContainers from './pages/ViewContainers';
import Networks from './pages/Networks';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import Plans from './pages/Plans';
import GitDeploy from './pages/GitDeploy';
import Volumes from './pages/Volumes';
import Secrets from './pages/Secrets';
import Registries from './pages/Registry';
import Marketplace from './pages/Marketplace';
import Layout from './components/Layout';
import { ThemeProvider } from './components/ThemeContext';
import ChatAssistant from './components/ChatAssistant';

// Global Axios config for HTTP-Only Cookies
axios.defaults.withCredentials = true;

// Interceptor to auto-logout on 401 Unauthorized
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.clear();
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const ProtectedRoute = ({ children }) => {
  return localStorage.getItem('role') ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  return localStorage.getItem('role') ? <Navigate to="/app" /> : children;
};

const App = () => {

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<PublicRoute><Welcome /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Protected Routes */}
        <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="create" element={<CreateContainer />} />
          <Route path="git-deploy" element={<GitDeploy />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="containers" element={<ViewContainers />} />
          <Route path="secrets" element={<Secrets />} />
          <Route path="registries" element={<Registries />} />
          <Route path="volumes" element={<Volumes />} />
          <Route path="networks" element={<Networks />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="plans" element={<Plans />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>

      {/* Global Chat Assistant rendered outside of all router layout contexts */}
      <ChatAssistant />
    </ThemeProvider>
  );
};

export default App;
