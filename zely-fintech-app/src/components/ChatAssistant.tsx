
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Loader2, Bot, User, Minimize2, Maximize2 } from 'lucide-react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

interface Account {
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
}

interface Transaction {
    id: string;
    title: string;
    amount: number;
    date: string;
    type: string;
    category: string;
}

interface ChatAssistantProps {
    account: Account;
    transactions: Transaction[];
    userName: string;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ account, transactions, userName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'model', text: `Hi ${userName}! I'm Zely, your AI financial assistant. How can I help you with your ${account.name} today?` }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatSessionRef = useRef<Chat | null>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    // Handle account changes - Reset chat to update context
    useEffect(() => {
        chatSessionRef.current = null;
        setMessages([
            { id: 'welcome', role: 'model', text: `Hi ${userName}! I'm Zely, your AI financial assistant. How can I help you with your ${account.name} today?` }
        ]);
        if (isOpen) {
            initializeChat();
        }
    }, [account.id]);

    // Initialize Chat Session with Context when opening
    useEffect(() => {
        if (isOpen && !chatSessionRef.current) {
            initializeChat();
        }
    }, [isOpen]);

    const initializeChat = () => {
        try {
            // Safety check for API Key to prevent app crash due to missing 'process'
            let apiKey: string | undefined;
            try {
                apiKey = process.env.API_KEY;
            } catch (e) {
                console.warn("process.env is not available");
            }

            if (!apiKey) {
                console.warn("Gemini API Key is missing. Chat assistant will be limited.");
                setMessages(prev => {
                    if (prev.some(m => m.id === 'error-key')) return prev;
                    return [...prev, { 
                        id: 'error-key', 
                        role: 'model', 
                        text: "I'm currently in offline mode because my API key is missing. Please configure the environment variables." 
                    }];
                });
                return;
            }

            const ai = new GoogleGenAI({ apiKey });
            
            const transactionHistory = transactions.slice(0, 10).map(t => 
                `- ${new Date(t.date).toLocaleDateString()}: ${t.title} (${t.type === 'incoming' ? '+' : '-'}${t.amount}) [${t.category}]`
            ).join('\n');

            const systemInstruction = `
                You are Zely, an expert AI financial assistant integrated into a Fintech app.
                
                Current User Context:
                - Name: ${userName}
                - Active Account: ${account.name} (${account.type})
                - Current Balance: ${account.currency}${account.balance.toFixed(2)}
                
                Recent Transactions:
                ${transactionHistory}

                Guidelines:
                1. Be concise, friendly, and professional.
                2. Use the context provided to answer questions about spending, balance, or specific transactions.
                3. If asked about features (transfer, bills, settings), guide them on how to use the dashboard.
                4. Do not provide specific financial investment advice; advise consulting a professional for that.
                5. Keep responses short (under 3 sentences) unless detailed analysis is requested.
                6. Avoid using markdown formatting like bold or headers, use plain text.
            `;

            chatSessionRef.current = ai.chats.create({
                model: 'gemini-3-flash-preview',
                config: {
                    systemInstruction: systemInstruction.trim(),
                },
            });
        } catch (error) {
            console.error("Failed to initialize Gemini chat:", error);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            if (!chatSessionRef.current) {
                initializeChat();
                // If still no session (e.g. missing key), stop
                if (!chatSessionRef.current) {
                     setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "I cannot connect to the AI service right now." }]);
                     setIsLoading(false);
                     return;
                }
            }
            
            if (chatSessionRef.current) {
                const result = await chatSessionRef.current.sendMessageStream({ message: userMessage });
                
                let fullResponse = "";
                const responseId = (Date.now() + 1).toString();
                
                // Add placeholder for streaming
                setMessages(prev => [...prev, { id: responseId, role: 'model', text: "" }]);

                for await (const chunk of result) {
                    const c = chunk as GenerateContentResponse;
                    if (c.text) {
                        fullResponse += c.text;
                        setMessages(prev => 
                            prev.map(msg => msg.id === responseId ? { ...msg, text: fullResponse } : msg)
                        );
                    }
                }
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { 
                id: Date.now().toString(), 
                role: 'model', 
                text: "I'm having trouble connecting right now. Please check your internet connection or try again later." 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-2xl hover:bg-primary-dark hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center group animate-enter-scale"
            >
                <div className="absolute inset-0 bg-primary/50 rounded-full animate-ping opacity-20 group-hover:opacity-40"></div>
                <MessageSquare className="w-7 h-7" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 ${isExpanded ? 'w-[90vw] h-[80vh] sm:w-[500px] sm:h-[700px]' : 'w-[90vw] sm:w-[380px] h-[500px]'} bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 animate-in slide-in-from-bottom-10 fade-in`}>
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-t-3xl flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-400 p-0.5">
                        <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Zely AI</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Online</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors hidden sm:block"
                    >
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button 
                        onClick={() => setIsOpen(false)} 
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-50/50 dark:bg-black/20">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            msg.role === 'user' 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300' 
                                : 'bg-primary/10 text-primary'
                        }`}>
                            {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-tr-none shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm'
                            }`}
                        >
                            {msg.text || <div className="flex gap-1 h-5 items-center"><span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span><span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span></div>}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-3xl">
                <form onSubmit={handleSend} className="relative flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask Zely about your finances..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3.5 pl-4 pr-12 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:text-white"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-light disabled:opacity-50 disabled:shadow-none transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </form>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        AI can make mistakes. Please verify important financial details.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatAssistant;
