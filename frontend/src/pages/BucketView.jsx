import { useTranslation } from "react-i18next";import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Upload, File, Trash2, Download, HardDrive, RefreshCw } from 'lucide-react';
import { useToast } from '../components/ToastContext';

const BucketView = ({ bucketName, onClose }) => {const { t } = useTranslation();
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    fetchObjects();
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [bucketName]);

  const fetchObjects = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/buckets/${bucketName}/objects`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setObjects(res.data || []);
    } catch (error) {
      console.error('Failed to load bucket objects:', error);
      addToast('Error loading objects.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      await axios.post(`/api/buckets/${bucketName}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      addToast(`File ${file.name} uploaded successfully!`, 'success');
      fetchObjects();
    } catch (error) {
      console.error('Failed to upload file:', error);
      const errMessage = error.response?.data?.message || 'Error uploading file';
      addToast(errMessage, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    }
  };

  const handleDeleteObject = async (objectName) => {
    if (!window.confirm(`Delete ${objectName}? This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/buckets/${bucketName}/objects/${encodeURIComponent(objectName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast(`Object ${objectName} deleted.`, 'success');
      fetchObjects();
    } catch (error) {
      console.error('Failed to delete object:', error);
      addToast('Error deleting object.', 'error');
    }
  };

  // Helper to format bytes to human readable sizes
  const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200">
            {/* Dark Scrim */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Drawer -> Slides in from right/bottom */}
            <div className="relative w-full md:w-[600px] lg:w-[800px] bg-white dark:bg-slate-900 shadow-md ml-auto h-full flex flex-col border-l border-slate-200 dark:border-slate-700">

                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                    <div className="flex items-center space-x-3 truncate pr-4">
                        <div className="p-2.5 rounded-sm bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 shrink-0">
                            <HardDrive size={24} />
                        </div>
                        <div className="truncate">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate" title={bucketName}>
                                {bucketName}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                {t("auto.minio_secure_bucket_object_storage")}
                            </p>
                        </div>
                    </div>
                    <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm transition-colors shrink-0">
            
                        <X size={24} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shrink-0">
                    <div>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {objects.length} {t("auto.object")}{objects.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex space-x-3">
                        <button
              onClick={fetchObjects}
              disabled={loading || uploading}
              className="p-2 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 bg-slate-100 hover:bg-brand-50 dark:bg-slate-800 dark:hover:bg-brand-500/10 rounded-sm transition-colors disabled:opacity-50"
              title={t("auto.refresh")}>
              
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>

                        <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload} />
            
                        <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-sm font-medium transition-colors shadow-sm shadow-brand-500/30 disabled:opacity-70">
              
                            {uploading ?
              <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div> :

              <Upload size={18} />
              }
                            <span className="hidden sm:inline">{uploading ? 'Uploading...' : 'Upload File'}</span>
                        </button>
                    </div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50 p-6">
                    {loading && objects.length === 0 ?
          <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
                        </div> :
          objects.length === 0 ?
          <div className="text-center py-24">
                            <File className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200">{t("auto.bucket_is_empty")}</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">{t("auto.upload_your_first_file_to_get_started_")}</p>
                        </div> :

          <div className="bg-white dark:bg-slate-800 rounded-sm border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-800/80">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("auto.name")}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">{t("auto.size")}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">{t("auto.modified")}</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("auto.actions")}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                    {objects.map((obj, idx) =>
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <File className="text-brand-500 dark:text-brand-400 shrink-0 mr-3" size={20} />
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-xs md:max-w-sm" title={obj.name}>
                                                        {obj.name}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                                                <div className="text-sm text-slate-500 dark:text-slate-400">{formatBytes(obj.size)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    {new Date(obj.lastModified).toLocaleDateString()} {new Date(obj.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <a
                        href={`/api/buckets/${bucketName}/objects/${encodeURIComponent(obj.name)}/download`} // Mock route for now, typically handled via presigned URLs
                        target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-sm transition-colors cursor-pointer"
                        title={t("auto.download_api_to_be_implemented")}
                        onClick={(e) => {e.preventDefault();addToast('Direct download requires presigned URL setup (coming next)', 'info');}}>
                        
                                                        <Download size={18} />
                                                    </a>
                                                    <button
                        onClick={() => handleDeleteObject(obj.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-sm transition-colors"
                        title={t("auto.delete_file")}>
                        
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                )}
                                </tbody>
                            </table>
                        </div>
          }
                </div>
            </div>
        </div>);

};

export default BucketView;