import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateContainer from './pages/CreateContainer';
import ViewContainers from './pages/ViewContainers';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import Layout from './components/Layout';
import { ThemeProvider } from './components/ThemeContext';

const App = () => {
  // Mock authentication state for now
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/app" /> : <Welcome />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/app" /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/app" /> : <Register />} />

        {/* Protected Routes */}
        <Route path="/app" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="create" element={<CreateContainer />} />
          <Route path="containers" element={<ViewContainers />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
};

export default App;
