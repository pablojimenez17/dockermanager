import { useTranslation } from 'react-i18next';
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Download, Terminal } from 'lucide-react';
import { io } from 'socket.io-client';

const LiveLogsModal = ({ containerId, containerName, onClose }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef(null);
  const socketRef = useRef(null);
  const containerRef = useRef(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    // Connect and subscribe to logs
    socketRef.current = io('', {
      withCredentials: true // Send the httpOnly auth cookie to the socket server
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('subscribe_logs', { containerId });
    });

    const handleLog = (data, isError = false) => {
      setLogs((prev) => {
        const newLogs = [...prev, { text: data, isError }];
        // Keep only the last 1000 lines to prevent browser memory bloat
        if (newLogs.length > 1000) return newLogs.slice(newLogs.length - 1000);
        return newLogs;
      });
    };

    socketRef.current.on('log_stdout', (data) => handleLog(data, false));
    socketRef.current.on('log_stderr', (data) => handleLog(data, true));

    socketRef.current.on('log_error', (errorMsg) => {
      handleLog(`[SYSTEM ERROR] ${errorMsg}`, true);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe_logs');
        socketRef.current.disconnect();
      }
    };
  }, [containerId]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScrollRef.current && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    autoScrollRef.current = isAtBottom;
  };

  const copyLogs = async () => {
    const text = logs.map((l) => l.text).join('');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLogs = () => {
    const text = logs.map((l) => l.text).join('');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerName}-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#1e1e1e] w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-[#252526]">
                    <div className="flex items-center space-x-3">
                        <Terminal className="text-brand-400" size={20} />
                        <h3 className="text-slate-200 font-mono font-bold tracking-wide">
                            {containerName} <span className="text-slate-500 font-normal">{t("auto._logs")}</span>
                        </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
              onClick={copyLogs}
              className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg flex items-center"
              title={t("auto.copy_to_clipboard")}>
              
                            {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                        </button>
                        <button
              onClick={downloadLogs}
              className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg flex items-center"
              title={t("auto.download_txt")}>
              
                            <Download size={18} />
                        </button>
                        <div className="w-px h-6 bg-slate-700 mx-2"></div>
                        <button
              onClick={onClose}
              className="text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-slate-700 rounded-lg">
              
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Logs Output */}
                <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed bg-[#1e1e1e]">
          
                    {logs.length === 0 ?
          <div className="text-slate-500 italic mt-4 ml-2">{t("auto.waiting_for_logs_")}</div> :

          <div className="whitespace-pre-wrap word-break-all">
                            {logs.map((log, index) =>
            <span
              key={index}
              className={log.isError ? 'text-red-400' : 'text-slate-300'}>
              
                                    {log.text}
                                </span>
            )}
                        </div>
          }
                    <div ref={logsEndRef} />
                </div>

                {/* Footer Status */}
                <div className="bg-[#007acc] text-white text-xs px-4 py-1.5 flex justify-between items-center font-mono">
                    <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2"></span>
                        {t("auto.live_streaming")}
                    </div>
                    <div>
                        {logs.length} {t("auto.lines")} {autoScrollRef.current ? '(Auto-scrolling)' : ''}
                    </div>
                </div>
            </div>
        </div>,
    document.body
  );
};

export default LiveLogsModal;