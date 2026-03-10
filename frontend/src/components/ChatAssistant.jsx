import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import axios from 'axios';

const ChatAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Hi! I am the Orbit AI Assistant. I can see your running containers and answer any questions you have. How can I help?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');

        // Add user message to UI immediately
        const newMessages = [...messages, { role: 'user', text: userMessage }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Include token so backend knows who is asking (optional, but good for security)
            const response = await axios.post('http://localhost:5000/api/ai/chat', {
                message: userMessage,
                history: messages // Exclude the very last user message we just appended locally
            });

            setMessages(prev => [...prev, { role: 'assistant', text: response.data.reply }]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg = error.response?.data?.error || 'Failed to connect to AI server. Please check your API key.';
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: `**Error:** ${errorMsg}`,
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Format markdown-like bolding simply for this MVP
    const formatText = (text) => {
        if (!text) return '';
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
            }
            return <React.Fragment key={i}>{part}</React.Fragment>;
        });
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">

            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[380px] h-[550px] max-h-[80vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 bg-brand-500 text-white">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Sparkles size={16} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Docker AI Assistant</h3>
                                <p className="text-xs text-brand-100 opacity-90">Context-Aware Helper</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                                    {/* Avatar */}
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 z-10
                                        ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 ml-2' :
                                            msg.isError ? 'bg-rose-100 dark:bg-rose-500/20 mr-2' : 'bg-brand-100 dark:bg-brand-500/20 mr-2'}`}
                                    >
                                        {msg.role === 'user' ? <User size={14} className="text-slate-600 dark:text-slate-300" /> :
                                            msg.isError ? <AlertCircle size={14} className="text-rose-500 dark:text-rose-400" /> : <Bot size={14} className="text-brand-500 dark:text-brand-400" />}
                                    </div>

                                    {/* Bubble */}
                                    <div className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words border
                                        ${msg.role === 'user'
                                            ? 'bg-brand-500 text-white border-brand-500 rounded-tr-sm'
                                            : msg.isError
                                                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20 rounded-tl-sm'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 shadow-sm rounded-tl-sm'}`}
                                    >
                                        {formatText(msg.text)}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex flex-row max-w-[85%]">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-500/20 mr-2 flex items-center justify-center mt-1">
                                        <Bot size={14} className="text-brand-500 dark:text-brand-400" />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-tl-sm flex items-center space-x-2">
                                        <Loader2 size={14} className="animate-spin text-brand-500" />
                                        <span className="text-sm text-slate-500 dark:text-slate-400">Analyzing Docker state...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                        <form onSubmit={handleSend} className="relative flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about your containers..."
                                className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 p-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-brand-500 transition-colors"
                            >
                                <Send size={16} className="ml-0.5" />
                            </button>
                        </form>
                        <div className="text-center mt-2">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Gemini AI can make mistakes. Verify commands.</p>
                        </div>
                    </div>

                </div>
            )}

            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 z-50
                    ${isOpen ? 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white rotate-90 shadow-slate-900/20' : 'bg-indigo-700 hover:bg-indigo-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white shadow-indigo-900/30'}`}
            >
                {isOpen ? <X size={24} className="-rotate-90 transition-transform" /> : <MessageSquare size={24} />}
            </button>

        </div>
    );
};

export default ChatAssistant;
