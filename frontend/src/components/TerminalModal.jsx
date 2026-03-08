import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io } from 'socket.io-client';
import { X } from 'lucide-react';
import 'xterm/css/xterm.css';

const TerminalModal = ({ containerId, containerName, onClose }) => {
    const terminalRef = useRef(null);
    const socketRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);

    useEffect(() => {
        // Initialize socket connection
        socketRef.current = io('http://localhost:5000', { withCredentials: true });

        // Initialize xterm.js
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0f172a', // slate-900
                foreground: '#f8fafc', // slate-50
                cursor: '#38bdf8', // light blue
                selectionBackground: 'rgba(56, 189, 248, 0.3)',
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Open terminal in the container div
        term.open(terminalRef.current);

        // Defer fit so the DOM has time to render the modal sizes
        setTimeout(() => {
            try {
                fitAddon.fit();
            } catch (e) {
                console.warn('Fit addon failed initially', e);
            }
        }, 100);

        term.writeln(`Connecting to ${containerName} (${containerId.substring(0, 12)})...`);

        // Connect terminal to socket
        socketRef.current.on('connect', () => {
            socketRef.current.emit('exec:start', { containerId });
        });

        socketRef.current.on('exec:ready', () => {
            term.clear();
            term.writeln(`\x1b[32mSuccessfully attached to ${containerName}\x1b[0m\r\n`);

            // Trigger initial resize
            setTimeout(() => {
                try {
                    fitAddon.fit();
                    const dims = fitAddon.proposeDimensions();
                    if (dims && dims.cols && dims.rows) {
                        socketRef.current.emit('exec:resize', { cols: dims.cols, rows: dims.rows });
                    }
                } catch (e) {
                    console.warn('Resize failed', e);
                }
            }, 100);
        });

        socketRef.current.on('exec:output', (data) => {
            term.write(data);
        });

        // Send user keystrokes to backend
        term.onData((data) => {
            socketRef.current.emit('exec:input', data);
        });

        // Handle window resizing
        const handleResize = () => {
            try {
                fitAddon.fit();
                const dims = fitAddon.proposeDimensions();
                if (dims && dims.cols && dims.rows && socketRef.current) {
                    socketRef.current.emit('exec:resize', { cols: dims.cols, rows: dims.rows });
                }
            } catch (err) {
                // Ignore resize errors during unmounts
            }
        };
        window.addEventListener('resize', handleResize);

        // Cleanup on unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            if (socketRef.current) socketRef.current.disconnect();
            if (xtermRef.current) xtermRef.current.dispose();
        };
    }, [containerId, containerName]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-brand-500 animate-pulse"></div>
                        <h3 className="text-slate-900 dark:text-white font-mono font-bold tracking-wide">
                            {containerName} terminal session
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Terminal Canvas */}
                <div
                    ref={terminalRef}
                    className="flex-1 p-4 bg-[#0f172a] overflow-hidden"
                />
            </div>
        </div>
    );
};

export default TerminalModal;
