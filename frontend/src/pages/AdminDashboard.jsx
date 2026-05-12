import { useTranslation } from "react-i18next";import React, { useEffect, useState, useRef } from 'react';
import { Users, Server, ShieldAlert, Trash2, MonitorPlay, Terminal, FileText, Clock, DatabaseBackup, RefreshCw, CheckCircle, AlertCircle, Database, Box, Globe, Settings2, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import TerminalModal from '../components/TerminalModal';
import { useToast } from '../components/ToastContext';

const AdminDashboard = () => {const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [containers, setContainers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTerminal, setActiveTerminal] = useState(null);
  const { addToast } = useToast();
  const [selectedLogs, setSelectedLogs] = useState(null);
  const [backupList, setBackupList] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  // Individual backup running states
  const [runningType, setRunningType] = useState(null); // 'all'|'db'|'server'|'web'
  // Scheduler config
  const [backupConfig, setBackupConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState(null);

  // Keep ref to latest containers for socket closure
  const containersRef = useRef([]);
  useEffect(() => {containersRef.current = containers;}, [containers]);

  const fetchData = async () => {
    try {
      const [usersRes, containersRes, auditRes] = await Promise.all([
      axios.get('/api/admin/users'),
      axios.get('/api/admin/containers'),
      axios.get('/api/admin/audit').catch(() => ({ data: [] }))]
      );
      setUsers(usersRes.data);
      setContainers(containersRes.data);
      setAuditLogs(auditRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching admin data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupList = async () => {
    setBackupLoading(true);
    try {
      const res = await axios.get('/api/admin/backup/list');
      setBackupList(res.data);
    } catch (err) {
      addToast('Backup List Error', err.response?.data?.message || 'Could not fetch backups from MinIO.', 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const fetchBackupConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await axios.get('/api/admin/backup/config');
      setBackupConfig(res.data);
      setLocalConfig({
        db:     { enabled: res.data.db.enabled,     intervalH: Math.round(res.data.db.intervalMs / 3600000) },
        server: { enabled: res.data.server.enabled, intervalH: Math.round(res.data.server.intervalMs / 3600000) },
        web:    { enabled: res.data.web.enabled,    intervalH: Math.round(res.data.web.intervalMs / 3600000) },
        retention: res.data.retention
      });
    } catch (err) {
      addToast('Config Error', 'Could not load backup scheduler config.', 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  const formatScheduleDate = (value) => {
    if (!value) return t('auto.not_scheduled');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('auto.not_scheduled');
    return date.toLocaleString();
  };

  const saveBackupConfig = async () => {
    setConfigSaving(true);
    try {
      await axios.put('/api/admin/backup/config', {
        db:     { enabled: localConfig.db.enabled,     intervalMs: localConfig.db.intervalH * 3600000 },
        server: { enabled: localConfig.server.enabled, intervalMs: localConfig.server.intervalH * 3600000 },
        web:    { enabled: localConfig.web.enabled,    intervalMs: localConfig.web.intervalH * 3600000 },
        retention: localConfig.retention
      });
      addToast('Config Saved', 'Backup scheduler updated and reloaded.', 'success');
      fetchBackupConfig();
    } catch (err) {
      addToast('Save Failed', err.response?.data?.message || 'Could not save config.', 'error');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleRunBackup = async (type = 'all') => {
    setRunningType(type);
    const labels = { all: 'Full System', db: 'Database', server: 'Backend', web: 'Frontend' };
    const endpoints = { all: '/api/admin/backup/run', db: '/api/admin/backup/run/db', server: '/api/admin/backup/run/server', web: '/api/admin/backup/run/web' };
    addToast('Backup Started', `Running ${labels[type]} backup...`, 'info');
    try {
      await axios.post(endpoints[type]);
      addToast('Backup Completed', `${labels[type]} backup stored in MinIO.`, 'success');
      fetchBackupList();
    } catch (err) {
      addToast('Backup Failed', err.response?.data?.error || `${labels[type]} backup failed.`, 'error');
    } finally {
      setRunningType(null);
    }
  };

  const handleDeleteBackup = async (bucket, filename) => {
    if (!window.confirm(`¿Eliminar "${filename}" de ${bucket}?`)) return;
    try {
      await axios.delete(`/api/admin/backup/${bucket}/${encodeURIComponent(filename)}`);
      addToast('Backup Deleted', `"${filename}" eliminado correctamente.`, 'success');
      fetchBackupList();
    } catch (err) {
      addToast('Delete Failed', err.response?.data?.message || 'No se pudo eliminar el backup.', 'error');
    }
  };

  useEffect(() => {
    fetchData();
    fetchBackupList();
    fetchBackupConfig();
    const interval = setInterval(fetchData, 30000);

    // Auto-reconnect socket — backend restarts won't force logout
    const socket = io('', {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 15000,
    });
    socket.on('connect', () => fetchData());

    socket.on('container:status_change', ({ dockerId, status }) => {
      const currentContainers = containersRef.current;
      const target = currentContainers.find((c) => dockerId.includes(c.dockerId) || c.dockerId.includes(dockerId));

      if (target) {
        if (status === 'die') {
          addToast(
            'Container Crashed',
            `Container ${target.name} stopped unexpectedly.`,
            'error',
            'View Crash Logs',
            () => fetchLogs(target._id, target.name)
          );
        } else if (status === 'stop') {
          addToast('Container Stopped', `${target.name} has been stopped.`, 'warning');
        } else if (status === 'start' || status === 'unpause') {
          addToast('Container Running', `${target.name} is now online.`, 'success');
        }

        setContainers((prevContainers) =>
        prevContainers.map((c) => {
          if (c.dockerId === target.dockerId) {
            return { ...c, state: status === 'die' || status === 'stop' ? 'stopped' : 'running' };
          }
          return c;
        })
        );
      }
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const fetchLogs = async (id, name) => {
    try {
      const res = await axios.get(`/api/stats/${id}/logs`);
      setSelectedLogs({ name, content: res.data });
    } catch (err) {
      setSelectedLogs({ name, content: "Error fetching logs or container not running." });
    }
  };

  const handleForceDelete = async (id) => {
    if (!window.confirm("Are you sure you want to forcibly remove this container for this user?")) return;
    try {
      const targetContainer = containers.find((c) => c._id === id);
      const cName = targetContainer ? targetContainer.name : 'Container';

      await axios.delete(`/api/admin/containers/${id}`);

      addToast('Container Deleted', `Forcefully unlinked and removed ${cName}`, 'error');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting container');
      addToast('Delete Failed', 'Admin override failed to remove container.', 'error');
    }
  };

  if (loading) return <div className="p-8 text-slate-900 dark:text-white">{t("auto.loading_admin_resources_")}</div>;

  if (error) return (
    <div className="p-8 text-slate-900 dark:text-white max-w-4xl mx-auto">
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-500 p-6 rounded-sm flex items-center mb-8">
                <ShieldAlert className="mr-3" size={32} />
                <div>
                    <h2 className="text-xl font-bold">{t("auto.access_denied")}</h2>
                    <p>{error}</p>
                </div>
            </div>
        </div>);


  return (
    <div className="p-4 md:p-8 pb-20 text-slate-900 dark:text-white max-w-6xl mx-auto">
            <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <ShieldAlert className="text-purple-600 dark:text-purple-500 shrink-0" size={40} />
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">{t("auto.admin_control_panel")}</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">{t("auto.system_wide_overview_of_users_and_contai")}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-sm shadow-sm relative overflow-hidden group col-span-1">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-500">
                        <Users size={64} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-purple-600 dark:text-purple-400 font-medium mb-1">{t("auto.total_users")}</h3>
                        <div className="text-5xl font-bold flex items-center space-x-3">
                            <span>{users.length}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-6 shadow-sm col-span-2 overflow-x-auto">
                    <h3 className="font-bold mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">{t("auto.registered_users")}</h3>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-slate-400">
                                <th className="pb-2">{t("auto.user_name")}</th>
                                <th className="pb-2">{t("auto.role")}</th>
                                <th className="pb-2">{t("auto.joined")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) =>
              <tr key={u._id} className="border-t border-slate-200 dark:border-slate-700/50">
                                    <td className="py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {u.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-3 text-slate-500 dark:text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                                </tr>
              )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Audit Logs Section */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-4 md:p-8 shadow-sm mb-12">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4 text-slate-900 dark:text-white">
                    <FileText className="text-brand-500 dark:text-brand-400" />
                    <span>{t("auto.system_audit_logs")}</span>
                </h3>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 shadow-sm border-b border-slate-200 dark:border-slate-700">
                            <tr className="text-slate-500 dark:text-slate-400">
                                <th className="p-4 rounded-tl-xl w-1/4">{t("auto.user")}</th>
                                <th className="p-4 w-1/4">{t("auto.action")}</th>
                                <th className="p-4 w-1/4">{t("auto.resource")}</th>
                                <th className="p-4 rounded-tr-xl w-1/4">{t("auto.time")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLogs.map((log) =>
              <tr key={log._id} className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                    <td className="p-4 font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">
                                            {log.userId?.name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <span>{log.userId?.name || 'Unknown'} <span className="text-xs text-slate-500 font-normal">({log.userId?.email || 'N/A'})</span></span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${log.action.includes('DELETE') ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                  log.action.includes('START') ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  log.action.includes('STOP') ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`
                  }>
                                            {log.action.replace('_CONTAINER', '')}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm max-w-xs truncate" title={log.resourceName}>
                                        {log.resourceName}
                                    </td>
                                    <td className="p-4 text-slate-500 dark:text-slate-400 flex items-center whitespace-nowrap">
                                        <Clock size={14} className="mr-2 opacity-70" />
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                </tr>
              )}
                            {auditLogs.length === 0 &&
              <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400">
                                        {t("auto.no_recent_actions_logged_")}
                                    </td>
                                </tr>
              }
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Backup Section */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-4 md:p-8 shadow-sm mb-12">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 border-b border-slate-200 dark:border-slate-700 pb-4 gap-4">
                    <h3 className="text-xl font-bold flex items-center space-x-2 text-slate-900 dark:text-white">
                        <DatabaseBackup className="text-emerald-500" />
                        <span>{t("auto.minio_backups")}</span>
                        <span className="text-sm font-normal text-slate-400 ml-1">({backupList.length} {t("auto.files_")}</span>
                    </h3>
                    <button id="admin-refresh-backups" onClick={fetchBackupList} disabled={backupLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-sm border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm disabled:opacity-50">
                        <RefreshCw size={14} className={backupLoading ? 'animate-spin' : ''} />{t("auto.refresh")}
                    </button>
                </div>

                {/* 4 Backup Action Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {[
                      { type: 'all',    label: t('auto.backup_all'),     icon: DatabaseBackup, color: 'emerald' },
                      { type: 'db',     label: t('auto.backup_db'),      icon: Database,       color: 'blue' },
                      { type: 'server', label: t('auto.backup_backend'), icon: Box,            color: 'amber' },
                      { type: 'web',    label: t('auto.backup_frontend'),icon: Globe,          color: 'purple' },
                    ].map(({ type, label, icon: Icon, color }) => (
                      <button key={type} id={`admin-backup-${type}`}
                        onClick={() => handleRunBackup(type)}
                        disabled={runningType !== null}
                        className={`flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-sm font-semibold text-sm transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed
                          bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-700/50
                          text-${color}-700 dark:text-${color}-300 hover:bg-${color}-100 dark:hover:bg-${color}-900/40`}>
                        {runningType === type
                          ? <RefreshCw size={20} className="animate-spin" />
                          : <Icon size={20} />}
                        <span>{runningType === type ? t('auto.running_') : label}</span>
                      </button>
                    ))}
                </div>

                {/* Scheduler Config */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-sm p-5 mb-8 bg-slate-50 dark:bg-slate-900/40">
                    <h4 className="font-bold flex items-center gap-2 mb-5 text-slate-800 dark:text-slate-200">
                        <Settings2 size={16} className="text-slate-500" />{t('auto.backup_scheduler_config')}
                    </h4>
                    {configLoading || !localConfig ? (
                      <div className="text-sm text-slate-400 py-4 text-center"><RefreshCw size={14} className="animate-spin inline mr-2" />{t('auto.loading_')}</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                          {[{key:'db',label:t('auto.backup_db'),color:'blue'},{key:'server',label:t('auto.backup_backend'),color:'amber'},{key:'web',label:t('auto.backup_frontend'),color:'purple'}].map(({key,label,color})=>(
                            <div key={key} className={`border border-${color}-200 dark:border-${color}-700/40 rounded-sm p-4 bg-white dark:bg-slate-800`}>
                              <div className="flex items-center justify-between mb-3">
                                <span className={`font-semibold text-sm text-${color}-700 dark:text-${color}-300`}>{label}</span>
                                <button onClick={()=>setLocalConfig(p=>({...p,[key]:{...p[key],enabled:!p[key].enabled}}))} className="transition-colors">
                                  {localConfig[key].enabled
                                    ? <ToggleRight size={24} className="text-emerald-500" />
                                    : <ToggleLeft  size={24} className="text-slate-400" />}
                                </button>
                              </div>
                              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t('auto.interval_hours')}</label>
                              <input type="number" min="1" max="720"
                                value={localConfig[key].intervalH}
                                onChange={e=>setLocalConfig(p=>({...p,[key]:{...p[key],intervalH:parseInt(e.target.value)||1}}))}
                                disabled={!localConfig[key].enabled}
                                className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-40 outline-none focus:ring-1 focus:ring-blue-500" />
                              <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <div>{t('auto.last_run')}: {formatScheduleDate(backupConfig?.[key]?.lastRunAt)}</div>
                                <div>{t('auto.next_run')}: {localConfig[key].enabled ? formatScheduleDate(backupConfig?.[key]?.nextRunAt) : t('auto.disabled')}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-end gap-4">
                          <div className="flex-1 max-w-[160px]">
                            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t('auto.backup_retention')}</label>
                            <input type="number" min="1" max="30"
                              value={localConfig.retention}
                              onChange={e=>setLocalConfig(p=>({...p,retention:parseInt(e.target.value)||1}))}
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <button onClick={saveBackupConfig} disabled={configSaving}
                            className="flex items-center gap-2 px-5 py-2 rounded-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow disabled:opacity-60">
                            {configSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {configSaving ? t('auto.saving_') : t('auto.save_config')}
                          </button>
                        </div>
                      </>
                    )}
                </div>

                {backupLoading && backupList.length === 0 ?
        <div className="py-10 text-center text-slate-400">{t("auto.loading_backups_from_minio_")}</div> :
        backupList.length === 0 ?
        <div className="py-10 text-center">
                        <AlertCircle className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={32} />
                        <p className="text-slate-400">{t("auto.no_backups_found_in_minio_yet_run_your_f")}</p>
                    </div> :

        <div className="overflow-x-auto rounded-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr className="text-slate-500 dark:text-slate-400">
                                    <th className="p-3 pl-4 rounded-tl-xl">{t("auto.filename")}</th>
                                    <th className="p-3">{t("auto.bucket")}</th>
                                    <th className="p-3">{t("auto.size")}</th>
                                    <th className="p-3">{t("auto.created")}</th>
                                    <th className="p-3 rounded-tr-xl"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {backupList.map((b, i) =>
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                        <td className="p-3 pl-4 font-mono text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                                            {b.filename}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  b.bucket === 'backups-mongodb' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                  b.bucket === 'backups-server' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`
                  }>{b.bucket?.replace('backups-', '')}</span>
                                        </td>
                                        <td className="p-3 text-slate-500 dark:text-slate-400">{b.sizeMb} {t("auto.mb")}</td>
                                        <td className="p-3 text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} className="opacity-60" />
                                                {new Date(b.createdAt).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <button
                    onClick={() => handleDeleteBackup(b.bucket, b.filename)}
                    className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-sm transition-colors border border-rose-500/20"
                    title={t("auto.eliminar_backup")}>
                    
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
              )}
                            </tbody>
                        </table>
                    </div>
        }
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-4 md:p-8 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4 text-slate-900 dark:text-white">
                    <Server className="text-brand-500 dark:text-brand-400" />
                    <span>{t("auto.global_container_instances_")}{containers.length})</span>
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal min-w-[600px]">
                        <thead>
                            <tr className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50">
                                <th className="p-4 rounded-tl-xl">{t("auto.container")}</th>
                                <th className="p-4">{t("auto.owner")}</th>
                                <th className="p-4">{t("auto.image")}</th>
                                <th className="p-4">{t("auto.state")}</th>
                                <th className="p-4 rounded-tr-xl">{t("auto.admin_actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map((c) =>
              <tr key={c._id} className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                    <td className="p-4 font-medium text-slate-900 dark:text-white">{c.name} <br /><span className="text-xs text-slate-500 dark:text-slate-500 font-mono">{c.dockerId.substring(0, 8)}</span></td>
                                    <td className="p-4 text-slate-600 dark:text-slate-300">{c.owner}</td>
                                    <td className="p-4 font-mono text-xs text-brand-600 dark:text-brand-300">{c.image}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full border text-xs font-semibold ${c.state === 'running' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500/50 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-500/50 dark:text-rose-400'}`
                  }>
                                            {c.state ? c.state.toUpperCase() : 'UNKNOWN'}
                                        </span>
                                    </td>
                                    <td className="p-4 flex space-x-2">
                                        {c.state === 'running' &&
                  <button
                    onClick={() => setActiveTerminal({ id: c.dockerId, name: c.name })}
                    className="p-2 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 rounded-sm transition-colors border border-brand-500/20"
                    title={t("auto.open_terminal")}>
                    
                                                <MonitorPlay size={16} />
                                            </button>
                  }
                                        <button
                    onClick={() => handleForceDelete(c._id)}
                    className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-sm transition-colors border border-rose-500/20"
                    title={t("auto.force_delete_container")}>
                    
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
              )}
                            {containers.length === 0 &&
              <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400">{t("auto.no_containers_found_on_the_host_")}</td>
                                </tr>
              }
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Terminal Modal */}
            {activeTerminal &&
      <TerminalModal
        containerId={activeTerminal.id}
        containerName={activeTerminal.name}
        onClose={() => setActiveTerminal(null)} />

      }

            {/* Logs Modal */}
            {selectedLogs &&
      <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-4xl rounded-sm shadow-md overflow-hidden flex flex-col h-[80vh]">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold flex items-center text-lg text-slate-900 dark:text-white"><Terminal className="mr-2 text-brand-500 dark:text-brand-400" /> {t("auto.logs_")} {selectedLogs.name}</h3>
                            <button onClick={() => setSelectedLogs(null)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                                {t("auto.close")}
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 font-mono text-sm bg-slate-50 text-slate-800 dark:bg-transparent dark:text-green-400 whitespace-pre-wrap leading-relaxed">
                            {selectedLogs.content || 'No logs available.'}
                        </div>
                    </div>
                </div>
      }
        </div>);

};

export default AdminDashboard;
