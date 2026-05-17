import { useTranslation } from "react-i18next"; import React, { useState, useEffect } from 'react';
import { Database, Globe, Lock, Play, Server, AlertCircle, Settings2, Cpu, HardDrive, Network, ChevronDown, ChevronUp, Plus, Trash2, Layers, Zap, ShieldAlert, Info } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../context/OrgContext';
import { resolveLimits } from '../utils/planLimits';
import { useToast } from '../components/ToastContext';

const getEmptyContainer = () => ({
  id: crypto.randomUUID(),
  name: '',
  image: '',
  portBinding: '',
  memory: '512',
  cpu: '1',
  restartPolicy: 'no',
  startupCommand: '',
  networkMode: 'bridge',
  enableInternet: false,
  extraNetworks: [],       // additional networks to connect after creation
  ipv4Address: '',
  isPublic: false,
  internalPort: '',
  freshData: false,
  envVars: [{ key: '', value: '', type: 'raw' }],
  showAdvanced: false,
  volumeName: '',
  volumeMountPath: ''
});

const CreateContainer = () => {
  const { t } = useTranslation();
  const { activeOrg, userPlan } = useOrg();
  const { addToast } = useToast();
  const [containers, setContainers] = useState([getEmptyContainer()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [availableVolumes, setAvailableVolumes] = useState([]);
  const [availableSecrets, setAvailableSecrets] = useState([]);
  const [limits, setLimits] = useState({ maxContainers: 2, maxRamMb: 1024, maxCpuCores: 1 });
  const [currentContainerCount, setCurrentContainerCount] = useState(0);
  const [currentRamMb, setCurrentRamMb] = useState(0);
  const [currentCpu, setCurrentCpu] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const role = localStorage.getItem('role');
        const planType = activeOrg ? activeOrg.plan : userPlan;
        const newLimits = resolveLimits({ planType, role });
        setLimits(newLimits);
        console.log('[CreateContainer] Calculated Limits INSTANTLY:', { newLimits, planType, role });

        // Load containers instantly without waiting for networks/volumes/secrets
        axios.get(`/api/containers?t=${Date.now()}`).then((myContainersRes) => {
          const currentCount = myContainersRes.data.length;
          setCurrentContainerCount(currentCount);

          let totalRam = 0;
          let totalCpu = 0;
          myContainersRes.data.forEach((c) => {
            if (c.hostConfig) {
              totalRam += (c.hostConfig.Memory || 0) / (1024 * 1024);
              totalCpu += (c.hostConfig.NanoCPUs || 0) / 1e9;
            }
          });

          const ramMb = Math.round(totalRam);
          const cpuCores = Math.round(totalCpu * 10) / 10;
          setCurrentRamMb(ramMb);
          setCurrentCpu(cpuCores);

          console.log('[CreateContainer] Current Usage:', { containers: currentCount, ram: ramMb, cpu: cpuCores });
        }).catch((err) => console.error("Failed to fetch containers for usage:", err));

        // Load networks, volumes and secrets independently — no await so they don't block each other
        axios.get('/api/networks').then((netRes) => {
          setAvailableNetworks(netRes.data || []);
        }).catch(() => setAvailableNetworks([]));

        axios.get('/api/volumes').then((volRes) => {
          setAvailableVolumes(volRes.data || []);
        }).catch(() => setAvailableVolumes([]));

        axios.get('/api/secrets').then((secRes) => {
          setAvailableSecrets(secRes.data || []);
        }).catch(() => setAvailableSecrets([]));

      } catch (err) {
        console.error("Failed to fetch context:", err);
      }
    };
    fetchContext();
  }, [activeOrg, userPlan]);

  const handleAddContainer = () => setContainers([...containers, getEmptyContainer()]);
  const handleRemoveContainer = (id) => {
    if (containers.length > 1) setContainers(containers.filter((c) => c.id !== id));
  };

  const updateContainer = (id, field, value) => setContainers(containers.map((c) => c.id === id ? { ...c, [field]: value } : c));
  const toggleAdvanced = (id) => setContainers(containers.map((c) => c.id === id ? { ...c, showAdvanced: !c.showAdvanced } : c));

  const updateEnvVar = (containerId, envIndex, field, value) => {
    setContainers(containers.map((c) => {
      if (c.id === containerId) {
        const newEnvVars = [...c.envVars];
        newEnvVars[envIndex] = { ...newEnvVars[envIndex], [field]: value };
        return { ...c, envVars: newEnvVars };
      }
      return c;
    }));
  };
  const addEnvVar = (containerId) => setContainers(containers.map((c) => c.id === containerId ? { ...c, envVars: [...c.envVars, { key: '', value: '', type: 'raw' }] } : c));
  const removeEnvVar = (containerId, envIndex) => setContainers(containers.map((c) => {
    if (c.id === containerId) {
      const newEnvVars = c.envVars.filter((_, idx) => idx !== envIndex);
      if (newEnvVars.length === 0) newEnvVars.push({ key: '', value: '', type: 'raw' });
      return { ...c, envVars: newEnvVars };
    }
    return c;
  }));

  const IMAGE_PRESETS = {
    'mysql': [{ key: 'MYSQL_ROOT_PASSWORD', value: '', type: 'secret' }, { key: 'MYSQL_DATABASE', value: 'mydb', type: 'raw' }],
    'postgres': [{ key: 'POSTGRES_USER', value: 'admin', type: 'raw' }, { key: 'POSTGRES_PASSWORD', value: '', type: 'secret' }],
    'mongo': [{ key: 'MONGO_INITDB_ROOT_USERNAME', value: 'admin', type: 'raw' }, { key: 'MONGO_INITDB_ROOT_PASSWORD', value: '', type: 'secret' }],
    'redis': [{ key: 'REDIS_PASSWORD', value: '', type: 'secret' }],
    'node': [{ key: 'NODE_ENV', value: 'production', type: 'raw' }, { key: 'PORT', value: '3000', type: 'raw' }]
  };

  const handleImageChange = (containerId, imageValue) => {
    updateContainer(containerId, 'image', imageValue);
    const imageName = imageValue.split(':')[0].split('/').pop().toLowerCase();
    const preset = Object.entries(IMAGE_PRESETS).find(([key]) => imageName.startsWith(key));
    if (preset && preset[1].length > 0) {
      setContainers((prev) => prev.map((c) => c.id === containerId ? { ...c, envVars: preset[1] } : c));
    }
  };

  const isInvalidEnvVar = (env) => {
    if (env.key.trim() === '') return false;
    if (env.type === 'secret') return env.value.trim() === '';
    return env.value.trim() === '';
  };

  const isBaseOsImage = (image) => {
    const imageName = image.split(':')[0].split('/').pop().toLowerCase();
    return ['ubuntu', 'debian', 'alpine', 'centos', 'kali-rolling', 'kali'].includes(imageName);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = containers.map((c) => {
        const invalidEnv = c.envVars.find((env) => isInvalidEnvVar(env));
        if (invalidEnv) {
          throw new Error(t("auto.env_validation_required_value"));
        }

        const validEnvVars = c.envVars.
          filter((env) => env.key.trim() !== '').
          map((env) => env.type === 'secret' ? `${env.key.trim()}={{SECRET:${env.value.trim()}}}` : `${env.key.trim()}=${env.value.trim()}`);

        return {
          name: c.name,
          image: c.image,
          ports: c.portBinding ? [c.portBinding] : [],
          env: validEnvVars,
          memory: c.memory,
          cpu: c.cpu,
          restartPolicy: c.restartPolicy,
          command: c.startupCommand.trim() || undefined,
          networkMode: c.networkMode,
  };

  const reqContainers = containers.length;
  const reqRam = containers.reduce((acc, curr) => acc + (parseInt(curr.memory) || 512), 0);
  const reqCpu = containers.reduce((acc, curr) => acc + (parseFloat(curr.cpu) || 1), 0);

  const overLimits = currentContainerCount + reqContainers > limits.maxContainers ||
    currentRamMb + reqRam > limits.maxRamMb || currentCpu + reqCpu > limits.maxCpuCores;

  return (
    <div className="text-gray-900 dark:text-slate-100 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">{t("auto.create_instance")}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">{t("auto.configure_and_deploy_new_container_insta")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error &&
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-4 rounded flex items-start space-x-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        }

        <div className="panel p-5">
          <h3 className="text-base font-semibold mb-4 flex items-center">
            <ShieldAlert size={16} className="mr-2 text-gray-400" /> {t("auto.resource_allocation_")} <span className="ml-1 font-normal text-gray-500">{activeOrg ? activeOrg.name : 'Personal Workspace'}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="flex justify-between mb-1"><span className="text-gray-500">{t("auto.containers")}</span><span className={currentContainerCount > limits.maxContainers ? 'text-red-500' : ''}>{currentContainerCount}/{limits.maxContainers}</span></div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded"><div className="bg-brand-500 h-1.5 rounded" style={{ width: `${Math.min(currentContainerCount / limits.maxContainers * 100, 100)}%` }}></div></div>
            </div>
            <div>
              <div className="flex justify-between mb-1"><span className="text-gray-500">{t("auto.memory")}</span><span className={currentRamMb > limits.maxRamMb ? 'text-red-500' : ''}>{currentRamMb}/{limits.maxRamMb} {t("auto.mb")}</span></div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded"><div className="bg-brand-500 h-1.5 rounded" style={{ width: `${Math.min(currentRamMb / limits.maxRamMb * 100, 100)}%` }}></div></div>
            </div>
            <div>
              <div className="flex justify-between mb-1"><span className="text-gray-500">{t("auto.cpu")}</span><span className={currentCpu > limits.maxCpuCores ? 'text-red-500' : ''}>{currentCpu}/{limits.maxCpuCores} {t("auto.vcpu")}</span></div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded"><div className="bg-brand-500 h-1.5 rounded" style={{ width: `${Math.min(currentCpu / limits.maxCpuCores * 100, 100)}%` }}></div></div>
            </div>
          </div>
          {overLimits && <p className="text-xs text-red-500 mt-4">{t("auto.limits_exceeded_by_current_configuration")}</p>}
        </div>

        <div className="space-y-6">
          {containers.map((c, index) =>
            <div key={c.id} className="panel overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t("auto.container")} {index + 1}</h3>
                {containers.length > 1 &&
                  <button type="button" onClick={() => handleRemoveContainer(c.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                }
              </div>

              <div className="p-5 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.container_name_")}</label>
                    <input type="text" required value={c.name} onChange={(e) => updateContainer(c.id, 'name', e.target.value)} placeholder={t("auto.app_frontend")} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-1 focus:ring-brand-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.docker_image_")}</label>
                    <input type="text" required value={c.image} onChange={(e) => handleImageChange(c.id, e.target.value)} placeholder={t("auto.nginx_latest")} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-1 focus:ring-brand-500 outline-none text-sm font-mono" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.port_binding_optional_")}</label>
                  <input
                    type="text"
                    value={c.portBinding}
                    onChange={(e) => updateContainer(c.id, 'portBinding', e.target.value)}
                    placeholder={t("auto.8080_80")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-1 focus:ring-brand-500 outline-none text-sm font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t("auto.format_host_container")}</p>
                </div>

                <div className="border border-gray-200 dark:border-slate-700 rounded p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 flex items-center">
                        {t("auto.public_access")}
                        <div className="relative group/tooltip ml-2 flex items-center">
                          <Info size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] p-2.5 rounded w-64 text-center z-[100] font-medium shadow-sm leading-relaxed">
                            {t("auto.public_access_info")}
                          </div>
                        </div>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{t("auto.public_access_auto_domain")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateContainer(c.id, 'isPublic', !c.isPublic)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${c.isPublic ? 'bg-brand-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {c.isPublic && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.internal_app_port")}</label>
                        <input
                          type="number"
                          min="1"
                          required={c.isPublic}
                          value={c.internalPort}
                          onChange={(e) => updateContainer(c.id, 'internalPort', e.target.value)}
                          placeholder={t("auto.e_g_3000")}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-1 focus:ring-brand-500 outline-none text-sm font-mono"
                        />
                      </div>
                      {isBaseOsImage(c.image) && (
                        <div className="text-xs rounded border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-3 leading-relaxed">
                          {t("auto.base_os_public_access_warning")}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 dark:border-slate-700 rounded overflow-hidden">
                  <button type="button" onClick={() => toggleAdvanced(c.id)} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-colors">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      <Settings2 size={16} className="mr-2" /> {t("auto.advanced_configuration")}
                    </span>
                    {c.showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {c.showAdvanced &&
                    <div className="p-5 space-y-6 border-t border-gray-200 dark:border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.memory_limit_mb_")}</label>
                          <input type="number" value={c.memory} onChange={(e) => updateContainer(c.id, 'memory', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.cpu_limit_cores_")}</label>
                          <input type="number" step="0.1" value={c.cpu} onChange={(e) => updateContainer(c.id, 'cpu', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.startup_command_optional")}</label>
                        <input
                          type="text"
                          value={c.startupCommand}
                          onChange={(e) => updateContainer(c.id, 'startupCommand', e.target.value)}
                          placeholder={t("auto.startup_command_placeholder")}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono"
                        />
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{t("auto.startup_command_help")}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                            {t("auto.network_mode")}
                            <div className="relative group/tooltip ml-2 flex items-center">
                              <Info size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] p-2.5 rounded w-56 text-center z-[100] font-medium shadow-sm leading-relaxed">
                                {t("auto.la_vpc_te_a_sla_de_otros_usuarios_proteg")}
                              </div>
                            </div>
                          </label>
                          <select value={c.networkMode} onChange={(e) => updateContainer(c.id, 'networkMode', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm">
                            <option value="bridge">Red Privada Protegida (VPC)</option>
                            <option value="none">Sin red (aislado)</option>
                            {availableNetworks.filter((n) => !['bridge', 'host', 'none'].includes(n.Name)).map((net) =>
                              <option key={net.Id} value={net.Name}>{net.Name}</option>
                            )}
                          </select>

                          {/* (El toggle superior de “Contenedor privado” se oculta para mantener solo “Acceso a Internet Activado”) */}

                          {/* ── Additional Networks ───────────────────── */}
                          {/* Contenedor de Acceso a Internet / Privacidad */}
                          {c.networkMode !== 'none' && (
                            <div className={`mt-4 flex items-center justify-between p-3.5 rounded-sm border transition-all ${c.enableInternet ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50' : 'bg-gray-50 dark:bg-slate-900/40 border-gray-200 dark:border-slate-700'}`}>
                              <div className="flex items-center space-x-3">
                                {c.enableInternet ? (
                                  <Globe size={18} className="text-amber-500 shrink-0" />
                                ) : (
                                  <Lock size={18} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 flex items-center">
                                    {c.enableInternet ? 'Acceso a Internet Activado' : 'Contenedor Privado'}
                                    <div className="relative group/tooltip ml-2 flex items-center">
                                      <Info size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] p-2.5 rounded w-56 text-center z-[100] font-medium shadow-sm leading-relaxed">
                                        {t("auto.internet_access_info")}
                                      </div>
                                    </div>
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                    {c.enableInternet
                                      ? t("auto.internet_enabled_warning")
                                      : t("auto.private_container_description")}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateContainer(c.id, 'enableInternet', !c.enableInternet)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${c.enableInternet ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.enableInternet ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.restart_policy")}</label>
                          <select value={c.restartPolicy} onChange={(e) => updateContainer(c.id, 'restartPolicy', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm">
                            <option value="no">{t("auto.no")}</option>
                            <option value="always">{t("auto.always")}</option>
                            <option value="unless-stopped">{t("auto.unless_stopped")}</option>
                            <option value="on-failure">{t("auto.on_failure")}</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.mount_volume")}</label>
                          <select value={c.volumeName || ''} onChange={(e) => updateContainer(c.id, 'volumeName', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm">
                            <option value="">{t("auto.none")}</option>
                            {availableVolumes.map((v) => <option key={v._id || v.name} value={v.name}>{v.name}</option>)}
                          </select>
                        </div>
                        {c.volumeName &&
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("auto.container_mount_path")}</label>
                            <input type="text" value={c.volumeMountPath || ''} onChange={(e) => updateContainer(c.id, 'volumeMountPath', e.target.value)} placeholder={t("auto._data")} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                          </div>
                        }
                      </div>

                      <div className="rounded border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{t("auto.fresh_data_mode")}</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">{t("auto.fresh_data_mode_description")}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateContainer(c.id, 'freshData', !c.freshData)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${c.freshData ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.freshData ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("auto.environment_variables")}</label>
                        <div className="space-y-2">
                          {c.envVars.map((env, eIdx) =>
                            <div key={eIdx} className="flex space-x-2">
                              <input type="text" placeholder={t("auto.key")} value={env.key} onChange={(e) => updateEnvVar(c.id, eIdx, 'key', e.target.value)} className="w-1/3 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                              <select value={env.type} onChange={(e) => updateEnvVar(c.id, eIdx, 'type', e.target.value)} className={`w-24 px-2 border rounded bg-white dark:bg-slate-900 text-xs ${isInvalidEnvVar(env) ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-600'}`}>
                                <option value="raw">{t("auto.raw")}</option>
                                <option value="secret">{t("auto.secret")}</option>
                              </select>
                              {env.type === 'secret' ?
                                <select value={env.value} onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)} className={`flex-1 px-3 py-1.5 border rounded bg-white dark:bg-slate-900 text-sm font-mono ${isInvalidEnvVar(env) ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-600'}`}>
                                  <option value="">{t("auto.select_secret")}</option>
                                  {availableSecrets.map((sec) => <option key={sec._id} value={sec.name}>{sec.name}</option>)}
                                </select> :

                                <input type="text" placeholder={t("auto.value")} value={env.value} onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)} className={`flex-1 px-3 py-1.5 border rounded bg-white dark:bg-slate-900 text-sm font-mono ${isInvalidEnvVar(env) ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-slate-600'}`} />
                              }
                              <button type="button" onClick={() => removeEnvVar(c.id, eIdx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={16} /></button>
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => addEnvVar(c.id)} className="mt-2 text-sm text-brand-600 hover:text-brand-700 flex items-center"><Plus size={14} className="mr-1" /> {t("auto.add_variable")}</button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 pt-4">
          <button type="button" onClick={handleAddContainer} className="btn-secondary flex items-center">
            <Plus size={16} className="mr-2" /> {t("auto.add_container")}
          </button>
          <div className="flex-1"></div>
          <button type="submit" disabled={loading || overLimits} className="btn-primary w-40 flex justify-center">
            {loading ? <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></span> : 'Deploy'}
          </button>
        </div>

        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start">
          <Info size={14} className="mr-1.5 shrink-0 mt-0.5" />
          {t("auto.public_domain_certificate_notice")}
        </p>
      </form>
    </div>);

};

export default CreateContainer;
