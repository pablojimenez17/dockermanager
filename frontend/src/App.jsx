import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateContainer from './pages/CreateContainer';
import ViewContainers from './pages/ViewContainers';
import Networks from './pages/Networks';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import Layout from './components/Layout';
import { ThemeProvider } from './components/ThemeContext';
import ChatAssistant from './components/ChatAssistant';

const ProtectedRoute = ({ children }) => {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  return localStorage.getItem('token') ? <Navigate to="/app" /> : children;
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
          <Route path="containers" element={<ViewContainers />} />
          <Route path="networks" element={<Networks />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>

      {/* Global Chat Assistant rendered outside of all router layout contexts */}
      <ChatAssistant />
    </ThemeProvider>
  );
};

export default App;
