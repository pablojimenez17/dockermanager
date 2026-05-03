import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusSquare, Server, Settings, LogOut, ShieldAlert, Sun, Moon, Network, CreditCard, GitBranch, HardDrive, Lock, ShieldCheck, Aperture, ChevronDown, Rocket, Briefcase, Database, Camera, X, Building2, Bell } from 'lucide-react';
import { useTheme } from './ThemeContext';
import OrgSwitcher from './OrgSwitcher';
import axios from 'axios';
import { useOrg } from '../context/OrgContext';
import { useNotifications } from '../context/NotificationContext';
import InvitesModal from './InvitesModal';
import AdBanner from './AdBanner';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [isInvitesModalOpen, setIsInvitesModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (e) {
      console.error('Logout error', e);
    }
    localStorage.clear();
    navigate('/');
  };

  const role = localStorage.getItem('role') || 'user';
  const location = useLocation();
  const { organizations, userPlan } = useOrg();

  const planType = userPlan || 'free';
  const hasOrgs = organizations && organizations.length > 0;
  const canCreateOrgs = ['agency', 'msp', 'partner'].includes(planType);
  const shouldShowOrgSetup = hasOrgs || canCreateOrgs;

  // Group definition
  const navGroups = [
  {
    title: t('sidebar.overview', 'Overview'),
    icon: <LayoutDashboard size={18} strokeWidth={1.5} />,
    items: [
    { name: t('sidebar.dashboard', 'Dashboard'), path: '/app', icon: <LayoutDashboard size={16} strokeWidth={1.5} /> }]

  },
  {
    title: t('sidebar.deployments', 'Deployments'),
    icon: <Rocket size={18} strokeWidth={1.5} />,
    items: [
    { name: t('sidebar.create_container', 'Create Container'), path: '/app/create', icon: <PlusSquare size={16} strokeWidth={1.5} /> },
    { name: t('sidebar.git_deploy', 'Deploy from Git'), path: '/app/git-deploy', icon: <GitBranch size={16} strokeWidth={1.5} /> },
    { name: t('sidebar.templates', 'Templates'), path: '/app/marketplace', icon: <Briefcase size={16} strokeWidth={1.5} /> }]

  },
  {
    title: t('sidebar.resources', 'Resources'),
    icon: <HardDrive size={18} strokeWidth={1.5} />,
    items: [
    { name: t('sidebar.instances', 'Instances'), path: '/app/containers', icon: <Server size={16} strokeWidth={1.5} /> },
    { name: t('sidebar.volumes', 'Volumes'), path: '/app/volumes', icon: <HardDrive size={16} strokeWidth={1.5} /> },
    { name: t('sidebar.snapshots', 'Snapshots'), path: '/app/snapshots', icon: <Camera size={16} strokeWidth={1.5} /> },
    { name: t('sidebar.networks', 'Networks'), path: '/app/networks', icon: <Network size={16} strokeWidth={1.5} /> },
    { name: t('sidebar.secrets', 'Secret Manager'), path: '/app/secrets', icon: <Lock size={16} strokeWidth={1.5} /> },
    { name: t('sidebar.registry', 'Private Registries'), path: '/app/registries', icon: <ShieldCheck size={16} strokeWidth={1.5} /> }]

  }];


  if (role === 'admin') {
    navGroups.push({
      title: t('sidebar.platform', 'Platform'),
      icon: <ShieldAlert size={18} strokeWidth={1.5} />,
      items: [
      { name: t('sidebar.administration', 'Administration'), path: '/app/admin', icon: <ShieldAlert size={16} strokeWidth={1.5} /> }]

    });
  }

  const userGroup = {
    title: t('sidebar.user', 'User'),
    icon: <Settings size={18} strokeWidth={1.5} />,
    items: [
    { name: t('sidebar.billing', 'Billing & Plans'), path: '/app/plans', icon: <CreditCard size={16} strokeWidth={1.5} /> },
    { name: t('sidebar.settings', 'Settings'), path: '/app/settings', icon: <Settings size={16} strokeWidth={1.5} /> }]

  };

  if (shouldShowOrgSetup) {
    userGroup.items.splice(1, 0, { name: 'Org Settings', path: '/app/organization', icon: <Building2 size={16} strokeWidth={1.5} /> });
  }

  navGroups.push(userGroup);

  const isGroupActive = (items) => {
    return items.some((item) => location.pathname === item.path || item.path !== '/app' && location.pathname.startsWith(item.path));
  };

  const [openGroups, setOpenGroups] = useState(
    navGroups.reduce((acc, group, index) => {
      acc[index] = isGroupActive(group.items) || index === 0;
      return acc;
    }, {})
  );

  const toggleGroup = (index) => {
    setOpenGroups((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className={`w-64 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col h-full transition-transform duration-200 ease-in-out z-40 fixed md:relative left-0 top-0 bottom-0 ${isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0'}`}>
            <div className="h-14 flex items-center justify-between px-4 shrink-0 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex items-center space-x-2">
                    <div className="text-brand-600 dark:text-brand-500">
                        <Aperture size={20} strokeWidth={2} />
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{t("auto.orbitcloud")}</span>
                </div>
                {/* Mobile Close Button */}
                <button
          onClick={() => setIsOpen(false)}
          className="md:hidden p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
          
                    <X size={18} />
                </button>
            </div>

            {shouldShowOrgSetup &&
      <div className="px-4 mt-4 hidden md:block">
                    <OrgSwitcher />
                </div>
      }

            <nav className="flex-1 px-2 space-y-1 mt-4 overflow-y-auto pb-4 custom-scrollbar">
                {navGroups.map((group, index) =>
        <div key={group.title} className="mb-2">
                        <button
            onClick={() => toggleGroup(index)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white uppercase tracking-wider transition-colors group">
            
                            <div className="flex items-center space-x-2">
                                {group.icon}
                                <span>{group.title}</span>
                            </div>
                            <ChevronDown
              size={14}
              strokeWidth={1.5}
              className={`transform transition-transform duration-200 ${openGroups[index] ? 'rotate-180 text-gray-700 dark:text-slate-300' : ''}`} />
            
                        </button>

                        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${openGroups[index] ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                            <div className="space-y-0.5 ml-3 pl-2 border-l border-gray-200 dark:border-slate-700 py-1">
                                {group.items.map((item) =>
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/app'}
                title={item.name}
                onClick={() => {
                  if (window.innerWidth < 768) setIsOpen(false);
                }}
                className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 transition-colors rounded-sm text-sm ${isActive ?
                'bg-blue-50 dark:bg-slate-800 text-brand-600 dark:text-brand-400 border-l-[3px] border-brand-600 dark:border-brand-500 font-medium' :
                'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200 border-l-[3px] border-transparent'}`

                }>
                
                                        <div className={`${({ isActive }) => isActive ? 'text-brand-600' : 'opacity-80'}`}>{item.icon}</div>
                                        <span className="truncate">{item.name}</span>
                                    </NavLink>
              )}
                            </div>
                        </div>
                    </div>
        )}
            </nav>

            <div className="px-4 shrink-0 mb-4">
                <AdBanner />
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-slate-700 space-y-1 shrink-0 bg-white dark:bg-slate-800">
                <button
          onClick={() => setIsInvitesModalOpen(true)}
          className="flex items-center space-x-3 px-3 py-2 w-full text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white rounded transition-colors relative group text-sm">
          
                    <Bell size={16} strokeWidth={1.5} className="group-hover:text-brand-600 transition-colors" />
                    <span>{t("auto.notifications")}</span>
                    {unreadCount > 0 &&
          <span className="absolute right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {unreadCount}
                        </span>
          }
                </button>
                
                {/* Theme Toggle Added Back */}
                <button
          onClick={toggleTheme}
          className="flex items-center space-x-3 px-3 py-2 w-full text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white rounded transition-colors text-sm group">
          
                    {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} className="group-hover:text-amber-500" /> : <Moon size={16} strokeWidth={1.5} className="group-hover:text-indigo-500" />}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                <button
          onClick={() => {
            const newLang = i18n.language === 'en' ? 'es' : 'en';
            i18n.changeLanguage(newLang);
            localStorage.setItem('language', newLang);
          }}
          className="flex items-center space-x-3 px-3 py-2 w-full text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white rounded transition-colors text-sm group">
                    <span className="text-base leading-none group-hover:scale-110 transition-transform">{i18n.language === 'en' ? '🇺🇸' : '🇪🇸'}</span>
                    <span>{i18n.language === 'en' ? 'English' : 'Español'}</span>
                </button>

                <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-3 py-2 w-full text-gray-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors group text-sm">
          
                    <LogOut size={16} strokeWidth={1.5} className="group-hover:text-red-500 transition-colors" />
                    <span>{t('sidebar.logout', 'Log Out')}</span>
                </button>
            </div>

            <InvitesModal isOpen={isInvitesModalOpen} onClose={() => setIsInvitesModalOpen(false)} />
        </div>);

};

export default Sidebar;