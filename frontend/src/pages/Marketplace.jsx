import { useTranslation } from "react-i18next";
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Server, Play, ShieldAlert, Trash2, HardDrive, Plus, Globe, Lock, Info } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import { useOrg } from '../context/OrgContext';
import { resolveLimits } from '../utils/planLimits';

const Marketplace = () => {
  const { t } = useTranslation();
  const WEB_PORT_CANDIDATES = new Set([80, 443, 3000, 3001, 8080, 8086, 2368, 1337, 5678, 9090, 11434, 15672, 9001]);
  const { activeOrg, userPlan } = useOrg();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [availableSecrets, setAvailableSecrets] = useState([]);

  // Deployment state
  const [customAppName, setCustomAppName] = useState('');

  // Unified env inputs: { KEY: { type: 'raw'|'secret', value: '' } }
  const [envFields, setEnvFields] = useState({});

  // Advanced Resource State
  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState('bridge');
  const [extraNetworks, setExtraNetworks] = useState([]); 
  const [enableInternet, setEnableInternet] = useState(false);
  const [memoryLimit, setMemoryLimit] = useState(512);
  const [cpuLimit, setCpuLimit] = useState(1);
  const [isPublic, setIsPublic] = useState(false);
  const [internalPort, setInternalPort] = useState('');
  
  // Volume Mounts State
  const [availableVolumes, setAvailableVolumes] = useState([]);
  const [volumeMounts, setVolumeMounts] = useState([]);

  // Plan Limits
  const [limits, setLimits] = useState({ maxContainers: 2, maxRamMb: 1024, maxCpuCores: 1 });
  const [currentContainerCount, setCurrentContainerCount] = useState(0);
  const [currentRamMb, setCurrentRamMb] = useState(0);
  const [currentCpu, setCurrentCpu] = useState(0);

  const { addToast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const role = localStorage.getItem('role');
        const planType = activeOrg ? activeOrg.plan : userPlan;
        const newLimits = resolveLimits({ planType, role });
        setLimits(newLimits);

        const cacheKey = `marketplace_cache_${activeOrg?._id || 'default'}`;
        const cachedData = sessionStorage.getItem(cacheKey);

        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            if (parsed.templates && parsed.templates.length > 0) {
              setTemplates(parsed.templates);
              setAvailableSecrets(parsed.availableSecrets || []);
              setNetworks(parsed.networks || []);
              setAvailableVolumes(parsed.availableVolumes || []);
              setLoading(false);
            }
          } catch (e) {}
        }

        axios.get(`/api/containers?t=${Date.now()}`).then((myContainersRes) => {
          const newContainerCount = myContainersRes.data.length;
          setCurrentContainerCount(newContainerCount);

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
        }).catch((err) => console.error("Failed to fetch containers for usage:", err));

        axios.get('/api/templates').then((tplRes) => {
          axios.get('/api/snapshots').catch(() => ({ data: [] })).then((snapRes) => {
            const mappedSnapshots = (snapRes.data || []).map((snap) => ({
              id: snap._id,
              name: snap.snapshotName,
              description: `Custom backup snapshot taken from ${snap.containerName}. Contains all modified files and configurations.`,
              category: 'My Snapshots',
              icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
              containers: [{
                name_prefix: snap.snapshotName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
                image: snap.imageId,
                ports: [{ host: '', container: 80 }],
                env: []
              }]
            }));

            const newTemplates = [...tplRes.data, ...mappedSnapshots];
            setTemplates(newTemplates);
            setLoading(false);

            sessionStorage.setItem(cacheKey, JSON.stringify({
              templates: newTemplates,
              availableSecrets: [],
              networks: [],
              availableVolumes: []
            }));
          });
        }).catch((err) => {
          console.error(err);
          addToast('Failed to load templates', 'error');
          setLoading(false);
        });

        axios.get('/api/networks').then((netRes) => {
          if (netRes?.data) {
            const mappedNetworks = netRes.data.map((n) => n.Name);
            if (!mappedNetworks.includes('bridge')) mappedNetworks.push('bridge');
            setNetworks(mappedNetworks);
            if (mappedNetworks.includes('dockermanager_lan_net')) {
              setSelectedNetwork('dockermanager_lan_net');
            }
          }
        }).catch(() => setNetworks(['bridge']));

        axios.get('/api/volumes').then((volRes) => {
          setAvailableVolumes(volRes.data || []);
        }).catch(() => setAvailableVolumes([]));

        axios.get('/api/secrets').then((secRes) => {
          setAvailableSecrets(secRes.data || []);
        }).catch(() => setAvailableSecrets([]));

      } catch (err) {
        console.error(err);
        addToast('Failed to load marketplace data', 'error');
        setLoading(false);
      }
    };
    fetchData();
  }, [addToast, activeOrg, userPlan]);

  const openTemplate = (template) => {
    const initial = {};
    const allEnvs = [...new Map(
      template.containers.
      flatMap((c) => c.env?.filter((e) => (e.type === 'secret' || e.type === 'input') && e.key !== 'url') || []).
      map((e) => [e.key, e])
    ).values()];

    allEnvs.forEach((e) => {
      const optionalByLabel = typeof e.label === 'string' && /optional/i.test(e.label);
      initial[e.key] = {
        type: e.type === 'secret' ? 'secret' : 'raw',
        value: e.value || '',
        label: e.label || e.key,
        required: e.required === true || (e.type === 'secret' && !optionalByLabel)
      };
    });

    setEnvFields(initial);

    const initialVols = [];
    template.containers.forEach((c, cIdx) => {
      if (c.volumes) {
        c.volumes.forEach((v) => {
          initialVols.push({
            id: Math.random().toString(36).substring(7),
            nodeIndex: cIdx,
            nodeName: c.name_prefix,
            containerPath: v.containerPath,
            volumeName: '',
            isPredefined: true,
            hostPath: v.hostPath
          });
        });
      }
    });
    setVolumeMounts(initialVols);

    setSelectedTemplate(template);
    setCustomAppName('');
    setMemoryLimit(512);
    setCpuLimit(1);
    setEnableInternet(false);
    setIsPublic(false);
    setInternalPort('');
    setSelectedNetwork('bridge');
    setExtraNetworks([]);
  };

  const closeModal = () => {
    setSelectedTemplate(null);
    setCustomAppName('');
    setEnvFields({});
    setVolumeMounts([]);
    setEnableInternet(false);
    setIsPublic(false);
    setInternalPort('');
    setExtraNetworks([]);
  };

  const updateEnvField = (key, field, value) => {
    setEnvFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  const isInvalidEnvField = (field) => {
    const value = (field?.value ?? '').toString().trim();
    if (!field?.required && value === '') return false;
    if (field?.type === 'secret') return value === '';
    return value === '';
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    setDeploying(true);
    try {
      const invalidEnvField = configuredEnvFields.find(([, field]) => isInvalidEnvField(field));
      if (invalidEnvField) {
        throw new Error(t("auto.env_validation_required_value"));
      }

      const stack = selectedTemplate.containers.map((cDef) => {
        let nodeName = `${cDef.name_prefix}-${Math.random().toString(36).substring(7)}`;
        if (customAppName && customAppName.trim() !== '') {
          nodeName = selectedTemplate.containers.length > 1 ?
          `${customAppName.trim()}-${cDef.name_prefix}` :
          customAppName.trim();
        }

        const finalEnv = [];
        if (cDef.env) {
          cDef.env.forEach((e) => {
            if (e.type === 'secret') {
              const vaultSecretName = envFields[e.key]?.value;
              if (vaultSecretName) {
                finalEnv.push(`${e.key}={{SECRET:${vaultSecretName}}}`);
              }
            } else if (e.type === 'input') {
              const rawValue = envFields[e.key]?.value || e.value;
              if (rawValue !== undefined) finalEnv.push(`${e.key}=${rawValue}`);
            } else if (e.value) {
              finalEnv.push(`${e.key}=${e.value}`);
            }
          });
        }

        const finalVolumes = [];
        volumeMounts.filter((m) => m.nodeIndex === selectedTemplate.containers.indexOf(cDef) && m.volumeName !== '').forEach((m) => {
          if (m.containerPath && m.containerPath.trim() !== '') {
            finalVolumes.push({
              source: m.volumeName,
              target: m.containerPath.trim()
            });
          }
        });

        return {
          name: nodeName,
          image: cDef.image,
          replicas: 1,
          ports: [],
          env: finalEnv,
          volumes: finalVolumes,
          memory: memoryLimit.toString(),
          cpu: cpuLimit.toString(),
          networkMode: selectedNetwork,
          enableInternet, 
          extraNetworks,  
          restartPolicy: "unless-stopped",
          isPublic,
          internalPort: isPublic ? internalPort : undefined,
        };
      });

      await axios.post('/api/containers', { stack });

      addToast(`${selectedTemplate.name} deployed successfully!`, 'success');
      closeModal();
    } catch (err) {
      addToast(err.response?.data?.message || 'Deployment failed', 'error');
    } finally {
      setDeploying(false);
    }
  };

  const configuredEnvFields = Object.entries(envFields);
  
  // ---> AQUÍ SE AÑADE EL CAMBIO PARA LOS DISCLAIMERS <---
  const getTemplateDisclaimers = (template) => {
    if (!template) return [];
    const notes = [];
    const containers = template.containers || [];
    const hasPersistentVolumes = containers.some((c) => (c.volumes || []).length > 0);
    const ports = containers.flatMap((c) => (c.ports || []).map((p) => Number(p.container)));
    const hasWebPort = ports.some((p) => WEB_PORT_CANDIDATES.has(p));
    const envKeys = new Set(containers.flatMap((c) => (c.env || []).map((e) => e.key)));

    notes.push(t("auto.public_domain_certificate_notice"));
    if (hasPersistentVolumes) {
      notes.push(t("auto.template_notice_volume_persistence_credentials"));
    }
    if (template.id === 'grafana' || (envKeys.has('GF_SECURITY_ADMIN_USER') && envKeys.has('GF_SECURITY_ADMIN_PASSWORD'))) {
      notes.push(t("auto.template_notice_grafana_credentials_first_boot"));
    }
    if (!hasWebPort) {
      notes.push(t("auto.template_notice_non_http_service"));
    }
    
    // Si la plantilla tiene un disclaimer personalizado en el JSON, lo añadimos
    if (template.disclaimer) {
      notes.push(template.disclaimer);
    }
    
    return notes;
  };
  const templateDisclaimers = selectedTemplate ? getTemplateDisclaimers(selectedTemplate) : [];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">{t("auto.templates")} <span className="text-sm bg-brand-500/10 text-brand-500 px-2.5 py-1 rounded-full ml-2 align-middle">{t("auto.beta")}</span></h1>
          <p className="text-slate-600 dark:text-slate-400">{t("auto.launch_powerful_pre_configured_stacks_in")}</p>
        </div>
      </div>

      <div className="mb-8 relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder={t("auto.search_apps_e_g_wordpress_database_redis")}
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm pl-12 pr-4 py-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {!loading &&
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-sm p-6 shadow-sm mb-8">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
            <ShieldAlert size={18} className="mr-2 text-brand-500" /> {t("auto.plan_resource_quotas_")} <span className="ml-1 font-normal text-slate-500">{activeOrg ? activeOrg.name : 'Personal Workspace'}</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">{t("auto.current_containers")}</span>
                <span className={`font-bold ${currentContainerCount > limits.maxContainers ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                  {currentContainerCount} / {limits.maxContainers}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${currentContainerCount > limits.maxContainers ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(currentContainerCount / limits.maxContainers * 100, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">{t("auto.current_ram_use")}</span>
                <span className={`font-bold ${currentRamMb > limits.maxRamMb ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                  {currentRamMb}{t("auto.mb_")} {limits.maxRamMb}{t("auto.mb")}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${currentRamMb > limits.maxRamMb ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(currentRamMb / limits.maxRamMb * 100, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">{t("auto.current_cpu_use")}</span>
                <span className={`font-bold ${currentCpu > limits.maxCpuCores ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                  {currentCpu} / {limits.maxCpuCores} {t("auto.vcpu")}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${currentCpu > limits.maxCpuCores ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(currentCpu / limits.maxCpuCores * 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      }

      {loading ?
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div> :

        <div className="space-y-12">
          {Object.entries(
            templates.
            filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase())).
            reduce((acc, t) => {
              acc[t.category] = acc[t.category] || [];
              acc[t.category].push(t);
              return acc;
            }, {})
          ).
          sort((a, b) => a[0].localeCompare(b[0])).
          map(([category, catTemplates]) =>
            <div key={category}>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center">
                {category}
                <span className="ml-3 px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                  {catTemplates.length}
                </span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {catTemplates.map((template) =>
                  <React.Fragment key={template.id}>
                    <div 
                      className={`bg-white dark:bg-slate-800 rounded-sm border overflow-hidden shadow-sm hover:shadow-sm transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer group ${selectedTemplate?.id === template.id ? 'border-brand-500 ring-1 ring-brand-400/60' : 'border-slate-200 dark:border-slate-700'}`} 
                      onClick={() => openTemplate(template)}
                    >
                      <div className="p-6 flex-1">
                        <div className="w-14 h-14 bg-slate-50 dark:bg-slate-900 rounded-sm flex items-center justify-center p-3 mb-4 border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
                          <img
                            src={template.icon}
                            alt={template.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {e.target.style.display = 'none';e.target.nextSibling.style.display = 'flex';}} />
                          <div className="w-full h-full items-center justify-center text-2xl font-bold text-slate-400 hidden">{template.name[0]}</div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{template.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">{template.description}</p>
                        <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-full">
                          {template.category}
                        </span>
                      </div>
                      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm flex items-center justify-between">
                        <span className="flex items-center"><Server size={14} className="mr-1.5" /> {template.containers.length} {t("auto.node")}{template.containers.length > 1 ? 's' : ''}</span>
                        <span className="text-brand-500 font-medium group-hover:text-brand-600">{t("auto.deploy_")}</span>
                      </div>
                    </div>

                    {selectedTemplate?.id === template.id && (
                      <div className="col-span-full mt-4 mb-8">
                        <div className="bg-white dark:bg-slate-800 w-full rounded-sm shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-top-4">
                          
                          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-sm flex items-center justify-center p-2.5 shadow-sm border border-slate-200 dark:border-slate-700">
                                <img
                                  src={selectedTemplate.icon}
                                  alt={t("auto.icon")}
                                  onError={(e) => {e.target.style.display = 'none';}} />
                              </div>
                              <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedTemplate.name}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTemplate.category} {t("auto.stack")}</p>
                              </div>
                            </div>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>

                          <div className="p-6">
                            <form onSubmit={handleDeploy} id="deployForm" className="space-y-6">

                              <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t("auto.1_app_configuration")}</h3>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("auto.custom_app_name_optional_")}</label>
                                    <input
                                      type="text"
                                      value={customAppName}
                                      onChange={(e) => setCustomAppName(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                                      placeholder={`e.g. my-${selectedTemplate.id}`} />
                                    <p className="text-xs text-slate-500 mt-2">{t("auto.used_as_a_prefix_for_your_deployed_conta")}</p>
                                  </div>

                                  {templateDisclaimers.length > 0 && (
                                    <div className="rounded-sm border border-amber-300/60 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/15 p-3">
                                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                                        {t("auto.template_deployment_notes")}
                                      </p>
                                      <ul className="space-y-1">
                                        {templateDisclaimers.map((note, idx) => (
                                          <li key={idx} className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">- {note}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {configuredEnvFields.length > 0 &&
                                <div>
                                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t("auto.2_environment_variables")}</h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t("auto.configure_the_app_s_required_variables_u")} <strong>{t("auto.secret")}</strong> {t("auto.to_link_to_your_vault_")}</p>
                                  <div className="space-y-3">
                                    {configuredEnvFields.map(([key, field]) =>
                                      <div key={key} className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:items-center sm:space-x-3">
                                        <input
                                          type="text"
                                          value={key}
                                          readOnly
                                          className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm text-slate-500 dark:text-slate-400 font-mono text-sm cursor-default" />
                                        
                                        <span className="text-slate-400 dark:text-slate-500 font-bold hidden sm:inline">=</span>
                                        <div className={`flex flex-1 bg-white dark:bg-slate-900 border rounded-sm overflow-hidden focus-within:ring-1 focus-within:ring-brand-500 ${isInvalidEnvField(field) ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                          <select
                                            value={field.type}
                                            onChange={(e) => updateEnvField(key, 'type', e.target.value)}
                                            className="bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:ring-0 outline-none w-24 border-r dark:border-slate-700 font-medium shrink-0">
                                            <option value="raw">{t("auto.raw")}</option>
                                            <option value="secret">{t("auto.secret")}</option>
                                          </select>
                                          {field.type === 'raw' ?
                                            <input
                                              type="text"
                                              value={field.value}
                                              onChange={(e) => updateEnvField(key, 'value', e.target.value)}
                                              placeholder={`e.g. ${field.value || field.label}`}
                                              className="flex-1 px-3 py-2 bg-transparent border-none text-slate-900 dark:text-white font-mono text-sm focus:ring-0 outline-none" /> :
                                            <select
                                              value={field.value}
                                              onChange={(e) => updateEnvField(key, 'value', e.target.value)}
                                              className="flex-1 px-3 py-2 bg-transparent border-none text-slate-900 dark:text-white font-mono text-sm focus:ring-0 outline-none">
                                              <option value="">{t("auto._select_secret_")}</option>
                                              {availableSecrets.map((sec) =>
                                                <option key={sec._id} value={sec.name}>{sec.name}</option>
                                              )}
                                            </select>
                                          }
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start mt-4">
                                    <ShieldAlert size={14} className="mr-1.5 shrink-0 mt-0.5" />
                                    {t("auto.secret_values_are_fetched_from_your_vaul")}
                                  </p>
                                </div>
                              }

                              <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t("auto.3_resources_network")}</h3>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center">
                                      {t("auto.network_mode")}
                                      <div className="relative group/tooltip ml-2 flex items-center">
                                        <Info size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] p-2.5 rounded w-56 text-center z-[100] font-medium shadow-sm leading-relaxed">
                                          {t("auto.la_vpc_te_a_sla_de_otros_usuarios_proteg")}
                                        </div>
                                      </div>
                                    </label>
                                    <select
                                      value={selectedNetwork}
                                      onChange={(e) => setSelectedNetwork(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                                      <option value="bridge">{t("auto._red_privada_protegida_vpc_")}</option>
                                      <option value="none">{t("auto._sin_red_aislado_total_")}</option>
                                      {networks.filter((n) => !['bridge', 'host', 'none'].includes(n) && !n.startsWith('dockermanager_')).map((net) =>
                                        <option key={net} value={net}>{net}</option>
                                      )}
                                    </select>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                      {t("auto.la_vpc_te_a_sla_de_otros_usuarios_sin_re")}
                                    </p>

                                    <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-sm p-3">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                                            {t("auto.public_access")}
                                            <div className="relative group/tooltip ml-2 flex items-center">
                                              <Info size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] p-2.5 rounded w-64 text-center z-[100] font-medium shadow-sm leading-relaxed">
                                                {t("auto.public_access_info")}
                                              </div>
                                            </div>
                                          </p>
                                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("auto.public_access_auto_domain")}</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setIsPublic((v) => !v)}
                                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                        >
                                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                      </div>
                                      {isPublic && (
                                        <div className="mt-3">
                                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("auto.internal_app_port")}</label>
                                          <input
                                            type="number"
                                            min="1"
                                            required={isPublic}
                                            value={internalPort}
                                            onChange={(e) => setInternalPort(e.target.value)}
                                            placeholder={t("auto.e_g_3000")}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                                          />
                                        </div>
                                      )}
                                    </div>

                                    {selectedNetwork !== 'none' && (
                                      <div className="mt-3">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="6" height="6"/><rect x="16" y="2" width="6" height="6"/><rect x="9" y="16" width="6" height="6"/><path d="M5 8v4h14V8"/><path d="M12 12v4"/></svg>
                                          Additional networks (container joins multiple simultaneously)
                                        </p>

                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                          {extraNetworks.map((n) => (
                                            <span key={n} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-mono border border-brand-200 dark:border-brand-700">
                                              {n}
                                              <button type="button" onClick={() => setExtraNetworks(extraNetworks.filter(x => x !== n))} className="text-brand-500 hover:text-red-500 transition-colors ml-0.5">✕</button>
                                            </span>
                                          ))}
                                        </div>

                                        <select
                                          value=""
                                          onChange={(e) => {
                                            if (!e.target.value) return;
                                            if (!extraNetworks.includes(e.target.value) && e.target.value !== selectedNetwork) {
                                              setExtraNetworks([...extraNetworks, e.target.value]);
                                            }
                                          }}
                                          className="w-full bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-sm px-4 py-2 text-slate-500 dark:text-slate-400 text-sm focus:outline-none"
                                        >
                                          <option value="">+ Add another network...</option>
                                          <option value="bridge">Bridge (Default VPC)</option>
                                          {networks
                                            .filter(n => !['host', 'none'].includes(n) && n !== selectedNetwork && !extraNetworks.includes(n) && !n.startsWith('dockermanager_'))
                                            .map(n => <option key={n} value={n}>{n}</option>)
                                          }
                                        </select>
                                      </div>
                                    )}
                                  </div>

                                  {selectedNetwork !== 'none' &&
                                    <div
                                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-sm border transition-all ${enableInternet ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'}`}
                                    >
                                      <div className="flex items-start sm:items-center space-x-3">
                                        {enableInternet ?
                                          <Globe size={18} className="text-amber-500 shrink-0 mt-0.5" /> :
                                          <Lock size={18} className="text-slate-400 shrink-0 mt-0.5" />
                                        }
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center flex-wrap">
                                            {enableInternet ? 'Acceso a Internet Activado' : 'Contenedor Privado'}
                                            <div className="relative group/tooltip ml-2 flex items-center">
                                              <Info size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] p-2.5 rounded w-56 text-center z-[100] font-medium shadow-sm leading-relaxed">
                                                {t("auto.internet_access_info")}
                                              </div>
                                            </div>
                                          </p>
                                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {enableInternet ?
                                              t("auto.internet_enabled_warning") :
                                              t("auto.private_container_description")
                                            }
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setEnableInternet((v) => !v)}
                                        className={`relative inline-flex h-6 w-11 items-center justify-center rounded-full transition-colors focus:outline-none self-start sm:self-auto ${enableInternet ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                      >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enableInternet ? 'translate-x-6' : 'translate-x-1'}`} />
                                      </button>
                                    </div>
                                  }

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("auto.memory_limit_mb_")}</label>
                                      <input
                                        type="number"
                                        min="128"
                                        max={limits.maxRamMb}
                                        value={memoryLimit}
                                        onChange={(e) => setMemoryLimit(Number(e.target.value))}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t("auto.cpu_limit_cores_")}</label>
                                      <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        max={limits.maxCpuCores}
                                        value={cpuLimit}
                                        onChange={(e) => setCpuLimit(Number(e.target.value))}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50" />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-4 mt-6">
                                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t("auto.4_persistent_volumes")}</h3>
                                  <button
                                    type="button"
                                    onClick={() => setVolumeMounts([...volumeMounts, {
                                      id: Math.random().toString(36).substring(7),
                                      nodeIndex: 0,
                                      nodeName: selectedTemplate.containers[0].name_prefix,
                                      containerPath: '',
                                      volumeName: '',
                                      isPredefined: false
                                    }])}
                                    className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-3 py-1.5 rounded-sm font-medium flex items-center transition-colors text-slate-700 dark:text-slate-300">
                                    <Plus size={14} className="mr-1" /> {t("auto.add_mount")}
                                  </button>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t("auto.select_existing_disks_to_persist_databas")}</p>

                                {volumeMounts.length === 0 ?
                                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-sm p-4 text-center border border-slate-200 dark:border-slate-700">
                                    <p className="text-sm text-slate-500">{t("auto.no_volumes_attached_data_will_be_ephemer")}</p>
                                  </div> :

                                  <div className="space-y-4">
                                    {volumeMounts.map((vol, idx) =>
                                      <div key={vol.id} className="flex flex-col sm:flex-row sm:space-x-4 items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-sm border border-slate-200 dark:border-slate-700 relative group">
                                        {!vol.isPredefined &&
                                          <button
                                            type="button"
                                            onClick={() => setVolumeMounts(volumeMounts.filter((v) => v.id !== vol.id))}
                                            className="absolute -top-2 -right-2 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={12} />
                                          </button>
                                        }

                                        <div className="flex-1 mb-3 sm:mb-0 w-full">
                                          {selectedTemplate.containers.length > 1 ?
                                            <div className="mb-2">
                                              <select
                                                disabled={vol.isPredefined}
                                                value={vol.nodeIndex}
                                                onChange={(e) => {
                                                  const newIdx = Number(e.target.value);
                                                  const updated = [...volumeMounts];
                                                  updated[idx].nodeIndex = newIdx;
                                                  updated[idx].nodeName = selectedTemplate.containers[newIdx].name_prefix;
                                                  setVolumeMounts(updated);
                                                }}
                                                className={`text-xs font-semibold px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none outline-none ${vol.isPredefined ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
                                                {selectedTemplate.containers.map((c, i) =>
                                                  <option key={i} value={i}>{c.name_prefix}</option>
                                                )}
                                              </select>
                                              {vol.isPredefined && <span className="text-xs text-slate-400 font-normal ml-2">({vol.hostPath})</span>}
                                            </div> :
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs mb-2">
                                              {vol.nodeName} {vol.isPredefined && <span className="text-slate-400 font-normal">({vol.hostPath})</span>}
                                            </div>
                                          }

                                          <div className="flex items-center w-full">
                                            <HardDrive size={14} className="mr-2 text-slate-400 shrink-0" />
                                            {vol.isPredefined ?
                                              <code className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-xs truncate max-w-[200px] text-slate-700 dark:text-slate-300">
                                                {vol.containerPath}
                                              </code> :
                                              <input
                                                type="text"
                                                placeholder={t("auto._app_data_custom")}
                                                value={vol.containerPath}
                                                onChange={(e) => {
                                                  const updated = [...volumeMounts];
                                                  updated[idx].containerPath = e.target.value;
                                                  setVolumeMounts(updated);
                                                }}
                                                className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 w-full text-slate-900 dark:text-white" />
                                            }
                                          </div>
                                        </div>
                                        <div className="w-full sm:w-64 shrink-0 mt-2 sm:mt-0">
                                          <select
                                            value={vol.volumeName}
                                            onChange={(e) => {
                                              const updated = [...volumeMounts];
                                              updated[idx].volumeName = e.target.value;
                                              setVolumeMounts(updated);
                                            }}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50">
                                            <option value="">{t("auto._no_persistence_")}</option>
                                            {availableVolumes.map((av) =>
                                              <option key={av._id} value={av.name}>{av.name}</option>
                                            )}
                                          </select>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                }
                              </div>
                            </form>
                          </div>

                          <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              <span className="font-semibold text-slate-600 dark:text-slate-300">{t("auto._shared_responsibility_")}</span>{' '}
                              {t("auto.orbit_guarantees_network_isolation_and_i")}
                            </p>
                            <div className="flex justify-end space-x-3">
                              <button
                                type="button"
                                onClick={closeModal}
                                className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-sm font-medium transition-colors">
                                {t("auto.cancel")}
                              </button>
                              <button
                                type="submit"
                                form="deployForm"
                                disabled={deploying}
                                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-sm font-bold shadow-sm shadow-brand-500/30 transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center">
                                {deploying ?
                                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> {t("auto.deploying_stack_")}</> :
                                  <><Play size={18} className="mr-2 fill-current" /> {t("auto.deploy")} {selectedTemplate.name}</>
                                }
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                )}
              </div>
            </div>
          )}
          {templates.filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 &&
            <div className="text-center py-20">
              <p className="text-slate-500 text-lg">{t("auto.no_templates_found_matching_your_search_")}</p>
            </div>
          }
        </div>
      }
    </div>
  );
};

export default Marketplace;
