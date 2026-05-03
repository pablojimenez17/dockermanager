import { useTranslation } from "react-i18next";import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Network, Plus, Trash2, ArrowLeft, TerminalSquare } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import { useOrg } from '../context/OrgContext';

const Networks = () => {const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    subnet: '',
    gateway: ''
  });

  const { addToast } = useToast();

  useEffect(() => {
    fetchNetworks();
  }, [activeOrg]);

  const fetchNetworks = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/networks');
      // Filter out some default docker networks to reduce clutter if desired, 
      // but we'll show all of them so the user knows what exists.
      setNetworks(res.data);
    } catch (error) {
      console.error('Failed to fetch networks:', error);
      addToast('Failed to load Docker networks.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNetwork = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/networks', formData);
      addToast(`Network ${formData.name} created successfully!`, 'success');
      setShowCreateModal(false);
      setFormData({ name: '', subnet: '', gateway: '' });
      fetchNetworks();
    } catch (error) {
      console.error('Failed to create network:', error);
      const errMessage = error.response?.data?.error || error.response?.data?.message || 'Error creating network';
      addToast(errMessage, 'error');
    }
  };

  const handleDeleteNetwork = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete network: ${name}?`)) return;

    try {
      await axios.delete(`/api/networks/${id}`);
      addToast(`Network ${name} deleted successfully!`, 'success');
      fetchNetworks();
    } catch (error) {
      console.error('Failed to delete network:', error);
      const errMessage = error.response?.data?.message || 'Error deleting network (it might be in use).';
      addToast(errMessage, 'error');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="p-4 sm:p-8 pb-20 text-slate-900 dark:text-white max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
                        <Network className="text-brand-500" size={36} />
                        {t("auto.docker_networks")}
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                        {t("auto.manage_custom_subnets_and_gateways_to_se")}
                    </p>
                </div>
                <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-sm font-medium transition-all duration-200 shadow-sm shadow-brand-500/30 active:scale-95">
          
                    <Plus size={20} />
                    <span>{t("auto.create_network")}</span>
                </button>
            </div>

            {loading ?
      <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
                </div> :

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {networks.length === 0 ?
        <div className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center py-24 px-4 bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm mt-4 text-center">
                            <div className="w-24 h-24 mb-6 relative">
                                {/* Removed blur orb */}
                                <div className="relative w-full h-full bg-brand-50 dark:bg-brand-500/10 rounded-sm flex items-center justify-center border border-brand-100 dark:border-brand-500/20 shadow-inner">
                                    <Network size={40} className="text-brand-500 drop-shadow-sm" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{t("auto.no_custom_networks")}</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm text-lg">{t("auto.you_haven_t_created_any_custom_subnets_y")}</p>
                        </div> :

        networks.map((net) => {
          const isDefault = ['bridge', 'host', 'none'].includes(net.Name);
          // Extract IPAM details
          const ipamConfig = net.IPAM?.Config?.[0] || {};
          const subnet = ipamConfig.Subnet || 'Auto-assigned';
          const gateway = ipamConfig.Gateway || 'Auto-assigned';

          return (
            <div key={net.Id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-6 shadow-sm hover:border-slate-400 dark:hover:border-slate-500 transition-colors flex flex-col group h-full">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center space-x-4 w-full">
                                            <div className="p-4 rounded-sm bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 shrink-0">
                                                <Network size={28} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2 break-all">
                                                    <span>{net.Name}</span>
                                                    {isDefault &&
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border border-slate-200 dark:border-slate-600 shrink-0">
                                                            {t("auto.system")}
                                                        </span>
                      }
                                                </h3>
                                                <p className="text-slate-500 dark:text-slate-400 font-mono text-sm mt-1">{t("auto.driver_")} {net.Driver}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6 mt-auto">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-sm p-4 border border-slate-200 dark:border-slate-700/50">
                                            <p className="text-xs text-slate-600 dark:text-slate-500 mb-1 uppercase tracking-wider font-semibold">{t("auto.subnet")}</p>
                                            <p className="font-mono text-sm text-slate-800 dark:text-slate-300 break-all">
                                                {subnet}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-sm p-4 border border-slate-200 dark:border-slate-700/50">
                                            <p className="text-xs text-slate-600 dark:text-slate-500 mb-1 uppercase tracking-wider font-semibold">{t("auto.gateway")}</p>
                                            <p className="font-mono text-sm text-slate-800 dark:text-slate-300 break-all" title={gateway}>
                                                {gateway}
                                            </p>
                                        </div>
                                    </div>

                                    {!isDefault ?
              <div className="flex items-center space-x-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-auto">
                                            <button
                  onClick={() => handleDeleteNetwork(net.Id, net.Name)}
                  className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-rose-600 dark:text-rose-400 border border-rose-500/20 py-2.5 rounded-sm font-medium transition-colors flex items-center justify-center space-x-2">
                  
                                                <Trash2 size={16} /> <span>{t("auto.remove_network")}</span>
                                            </button>
                                        </div> :

              <div className="pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-auto opacity-50">
                                            <button disabled className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 py-2.5 rounded-sm font-medium flex items-center justify-center space-x-2 cursor-not-allowed">
                                                <Trash2 size={16} /> <span>{t("auto.protected")}</span>
                                            </button>
                                        </div>
              }
                                </div>);

        })
        }
                </div>
      }

            {/* Create Network Modal */}
            {showCreateModal &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-sm shadow-md w-full max-w-md m-auto border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                                <Network className="text-brand-500" />
                                <span>{t("auto.create_custom_network")}</span>
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateNetwork} className="p-6">
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        {t("auto.network_name")} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={t("auto.e_g_custom_bridge_net")}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 dark:text-white transition-all outline-none" />
                
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            {t("auto.subnet")} <span className="text-slate-400 font-normal text-xs">{t("auto._optional_")}</span>
                                        </label>
                                        <input
                    type="text"
                    name="subnet"
                    value={formData.subnet}
                    onChange={handleChange}
                    placeholder={t("auto.10_0_0_0_16")}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 dark:text-white transition-all outline-none font-mono text-sm" />
                  
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            {t("auto.gateway")} <span className="text-slate-400 font-normal text-xs">{t("auto._optional_")}</span>
                                        </label>
                                        <input
                    type="text"
                    name="gateway"
                    value={formData.gateway}
                    onChange={handleChange}
                    placeholder={t("auto.10_0_0_1")}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-900 dark:text-white transition-all outline-none font-mono text-sm" />
                  
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 bg-brand-50 dark:bg-brand-500/10 p-3 rounded-sm border border-brand-100 dark:border-brand-500/20">
                                    <strong className="text-brand-600 dark:text-brand-400">{t("auto.tip_")}</strong> {t("auto.custom_networks_isolate_your_containers_")}
                                </p>
                            </div>
                            <div className="mt-8 flex justify-end space-x-3">
                                <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-sm font-medium transition-colors">
                                    {t("auto.cancel")}
                                
              </button>
                                <button
                type="submit"
                disabled={!formData.name}
                className="px-5 py-2.5 bg-brand-500 text-white rounded-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-500/20 hover:shadow-sm hover:shadow-brand-500/40">
                                    {t("auto.create_network")}
                                
              </button>
                            </div>
                        </form>
                    </div>
                </div>
      }
        </div>);

};

export default Networks;