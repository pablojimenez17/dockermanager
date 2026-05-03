import { useTranslation } from "react-i18next";import React, { useState, useEffect } from 'react';
import { GitBranch, Globe, HardDrive, Play, ShieldAlert, AlertCircle, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../context/OrgContext';
import { resolveLimits } from '../utils/planLimits';

const GitDeploy = () => {const { t } = useTranslation();
  const { activeOrg, userPlan } = useOrg();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [limits, setLimits] = useState({ maxContainers: 2, maxDomains: 0 });
  const [currentUsage, setCurrentUsage] = useState({ containers: 0, domains: 0 });
  const [webhookData, setWebhookData] = useState(null);

  const [form, setForm] = useState({
    name: '',
    gitUrl: '',
    branch: 'main',
    domain: '',
    domainPort: '80',
    env: [{ key: '', value: '' }]
  });

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const role = localStorage.getItem('role');
        const planType = activeOrg ? activeOrg.plan : userPlan;
        const newLimits = resolveLimits({ planType, role });
        setLimits(newLimits);
        console.log('[GitDeploy] Calculated Limits INSTANTLY:', { newLimits, planType, role });

        const [containersRes] = await Promise.all([
        axios.get(`/api/containers?t=${Date.now()}`)]
        );

        const activeContainers = containersRes.data;
        const activeDomains = activeContainers.filter((c) => c.domain && c.domain.trim() !== '').length;

        console.log('[GitDeploy] Current Usage:', { containers: activeContainers.length, domains: activeDomains });

        setCurrentUsage({
          containers: activeContainers.length,
          domains: activeDomains
        });
      } catch (err) {
        console.error("Failed to fetch context:", err);
      }
    };
    fetchContext();
  }, [activeOrg, userPlan]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const updateEnvVar = (index, field, value) => {
    const newEnv = [...form.env];
    newEnv[index][field] = value;
    setForm({ ...form, env: newEnv });
  };

  const addEnvVar = () => setForm({ ...form, env: [...form.env, { key: '', value: '' }] });
  const removeEnvVar = (index) => {
    const newEnv = form.env.filter((_, i) => i !== index);
    if (newEnv.length === 0) newEnv.push({ key: '', value: '' });
    setForm({ ...form, env: newEnv });
  };

  const isExceedingContainers = currentUsage.containers + 1 > limits.maxContainers;
  const isExceedingDomains = form.domain.trim() !== '' && currentUsage.domains + 1 > limits.maxDomains;
  const isExceedingLimits = isExceedingContainers || isExceedingDomains;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/git/deploy', form);
      setWebhookData({
        url: res.data.webhookUrl,
        secret: res.data.webhookSecret
      });
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Error deploying from Git');
      setLoading(false);
    }
  };

  if (webhookData) {
    return (
      <div className="p-4 sm:p-8 pb-20 text-slate-900 dark:text-white max-w-2xl mx-auto text-center mt-12 animate-in fade-in slide-in-from-bottom-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h1 className="text-3xl font-extrabold mb-4">{t("auto.deployment_successful_")}</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-8">
                    {t("auto.your_code_has_been_built_and_deployed_gl")} <b>{t("auto.zero_downtime_auto_deployments")}</b> {t("auto.every_time_you_push_to_this_repository_c")}
                </p>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-sm p-6 text-left space-y-4 mb-8">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("auto.payload_url")}</label>
                        <code className="block w-full p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm font-mono text-sm text-brand-600 dark:text-brand-400 break-all select-all">
                            {webhookData.url}
                        </code>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("auto.secret_hmac_sha_256_")}</label>
                        <code className="block w-full p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm font-mono text-sm text-purple-600 dark:text-purple-400 break-all select-all">
                            {webhookData.secret}
                        </code>
                        <p className="text-xs text-amber-500 mt-2 font-medium">{t("auto._copy_this_secret_now_it_is_encrypted_in")}</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("auto.content_type")}</label>
                        <code className="block w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm font-mono text-sm dark:text-slate-300">
                            {t("auto.application_json")}
                        </code>
                    </div>
                </div>

                <button
          onClick={() => navigate('/app/containers')}
          className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-4 rounded-sm font-bold w-full transition-colors shadow-sm shadow-brand-500/30">
                    {t("auto.i_have_saved_the_webhook_take_me_to_my_c")}
                
        </button>
            </div>);

  }

  return (
    <div className="p-4 sm:p-8 pb-20 text-slate-900 dark:text-white max-w-4xl mx-auto">
            <div className="mb-10 text-center">
                <div className="inline-flex items-center justify-center p-4 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-sm mb-4">
                    <GitBranch size={40} />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">{t("auto.deploy_from_git")}</h1>
                <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">{t("auto.paste_a_repository_url_we_ll_clone_build")}</p>
            </div>

            {/* Quotas Visualization */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-sm p-6 shadow-sm mb-8">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                    <ShieldAlert size={18} className="mr-2 text-brand-500" /> {t("auto.current_plan_quotas_")} <span className="ml-1 font-normal text-slate-500">{activeOrg ? activeOrg.name : 'Personal Workspace'}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">{t("auto.current_containers")}</span>
                            <span className={`font-bold ${isExceedingContainers ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {currentUsage.containers} / {limits.maxContainers}
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5 flex">
                            <div className={`h-1.5 rounded-full ${isExceedingContainers ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(currentUsage.containers / limits.maxContainers * 100, 100)}%` }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">{t("auto.current_custom_domains")}</span>
                            <span className={`font-bold ${isExceedingDomains ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {currentUsage.domains} / {limits.maxDomains}
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5 flex">
                            <div className={`h-1.5 rounded-full ${isExceedingDomains ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(currentUsage.domains / (limits.maxDomains || 1) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-8 shadow-sm">
                {error &&
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm py-4 px-4 rounded-sm flex items-start space-x-3">
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
        }

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("auto.app_name")}</label>
                        <input
              type="text"
              required
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder={t("auto.e_g_my_awesome_app")}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm focus:ring-2 focus:ring-brand-500 outline-none" />
            
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("auto.repository_url")}</label>
                        <input
              type="url"
              required
              name="gitUrl"
              value={form.gitUrl}
              onChange={handleChange}
              placeholder={t("auto.https_github_com_user_repo_git")}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm focus:ring-2 focus:ring-brand-500 outline-none" />
            
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("auto.branch")}</label>
                        <input
              type="text"
              name="branch"
              value={form.branch}
              onChange={handleChange}
              placeholder={t("auto.main")}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm focus:ring-2 focus:ring-brand-500 outline-none" />
            
                    </div>
                </div>

                <div className="p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 rounded-sm space-y-4">
                    <h4 className="font-bold flex items-center text-purple-900 dark:text-purple-300">
                        <Globe className="mr-2" size={20} /> {t("auto.domain_routing_traefik_")}
                    </h4>
                    <p className="text-sm text-purple-700/80 dark:text-purple-400/80">
                        {t("auto.attach_a_custom_domain_to_this_applicati")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-medium text-purple-800 dark:text-purple-300 mb-1">{t("auto.domain_name")}</label>
                            <input
                type="text"
                name="domain"
                value={form.domain}
                onChange={handleChange}
                placeholder={t("auto.api_myapp_com")}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-500/30 rounded-sm focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
              
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-purple-800 dark:text-purple-300 mb-1">{t("auto.internal_container_port")}</label>
                            <input
                type="number"
                name="domainPort"
                value={form.domainPort}
                onChange={handleChange}
                placeholder={t("auto.e_g_3000")}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-500/30 rounded-sm focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
              
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("auto.build_environment_variables")}</label>
                    <div className="space-y-3 mb-3">
                        {form.env.map((env, eIdx) =>
            <div key={eIdx} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:items-center sm:space-x-3">
                                <input
                type="text"
                placeholder={t("auto.key")}
                value={env.key}
                onChange={(e) => updateEnvVar(eIdx, 'key', e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm font-mono text-sm outline-none" />
              
                                <span className="text-slate-400 font-bold">=</span>
                                <input
                type="text"
                placeholder={t("auto.value")}
                value={env.value}
                onChange={(e) => updateEnvVar(eIdx, 'value', e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm font-mono text-sm outline-none" />
              
                                <button
                type="button"
                onClick={() => removeEnvVar(eIdx)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                
                                    <Trash2 size={18} />
                                </button>
                            </div>
            )}
                    </div>
                    <button
            type="button"
            onClick={addEnvVar}
            className="text-sm font-bold text-brand-500 hover:text-brand-600 flex items-center">
            
                        <Plus size={16} className="mr-1" /> {t("auto.add_variable")}
                    </button>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                    <button
            type="submit"
            disabled={loading || isExceedingLimits}
            className={`w-full flex justify-center items-center py-4 rounded-sm shadow-sm font-bold text-white transition-all ${loading || isExceedingLimits ? 'bg-slate-600 opacity-70 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600'}`
            }>
            
                        {loading ?
            <span className="flex items-center">
                                <span className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full mr-2"></span>
                                {t("auto.cloning_building_this_may_take_a_few_min")}
                            </span> :

            <span className="flex items-center">
                                {t("auto.build_deploy")} <Play className="ml-2" size={20} />
                            </span>
            }
                    </button>
                </div>
            </form>
        </div>);

};

export default GitDeploy;