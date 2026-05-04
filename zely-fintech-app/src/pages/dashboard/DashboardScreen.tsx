
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowDownLeft, Receipt, ArrowUpRight, Plus, User } from 'lucide-react';
import { accountsData } from '../../utils/mockData';
import TransactionDetailsModal from '../../components/TransactionDetailsModal';
import { Transaction } from '../../utils/types';
import { useAsync } from '../../hooks/useAsync';
import { transactionService } from '../../services/transactionService';
import StateRenderer from '../../components/common/StateRenderer';

const DashboardScreen: React.FC = () => {
    const navigate = useNavigate();
    
    // Use Custom Hook for Data Fetching
    const { 
        data: transactions, 
        loading: loadingTransactions, 
        error: errorTransactions,
        execute: refreshTransactions
    } = useAsync<Transaction[]>(useCallback(() => transactionService.getRecent(10), [])); // Fetch more to get contacts

    // Simple Account State (Mocked)
    const [accounts, setAccounts] = useState(accountsData);
    const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

    // API Call Preparation (Commented out for production use later)
    /*
    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                // const response = await fetch('/api/user/accounts');
                // if(response.ok) {
                //    const data = await response.json();
                //    setAccounts(data);
                // }
            } catch (error) {
                console.error("Failed to load accounts", error);
            }
        };
        fetchAccounts();
    }, []);
    */

    // Personalization State
    const [greeting, setGreeting] = useState('');
    const [userName, setUserName] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    useEffect(() => {
        const name = localStorage.getItem('userName') || 'User';
        setUserName(name);

        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, []);

    const formatDate = (isoDate: string) => {
        const d = new Date(isoDate);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Derive Recent Contacts from Transactions
    const recentContacts = useMemo(() => {
        if (!transactions) return [];
        const contacts = new Map();
        transactions.forEach(tx => {
            if (tx.type === 'outgoing' && tx.recipientName) {
                if (!contacts.has(tx.recipientName)) {
                    contacts.set(tx.recipientName, { name: tx.recipientName, avatar: tx.recipientAvatar });
                }
            }
        });
        return Array.from(contacts.values()).slice(0, 5);
    }, [transactions]);

    const handleQuickTransfer = (recipientName: string) => {
        navigate(`/transfers?recipient=${encodeURIComponent(recipientName)}&type=p2p`);
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Header / Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        {greeting}, <span className="text-primary">{userName}</span> 👋
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                        Here's your financial overview.
                    </p>
                </div>
                <button onClick={() => navigate('/fund-wallet')} className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm text-sm">
                    <Plus className="w-4 h-4" /> Add Money
                </button>
            </div>

            {/* Total Balance Card text-center to text-left etc - totally flat styling */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-8 shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Balance</span>
                        <div className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300 text-[10px] font-bold">NGN</div>
                    </div>
                    <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
                        ₦{totalBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </h2>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button onClick={() => navigate('/transfers')} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-sm">
                        <Send className="w-4 h-4" /> Transfer
                    </button>
                    <button onClick={() => navigate('/savings')} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white border border-slate-700 rounded-xl font-bold hover:bg-slate-700 transition-colors shadow-sm">
                        <Receipt className="w-4 h-4" /> Savings
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Quick Transfer & Cards */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Quick Transfer */}
                    {recentContacts.length > 0 && (
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Quick Transfer</h3>
                            <div className="flex gap-4 overflow-x-auto p-1 pb-4 no-scrollbar">
                                <button 
                                    onClick={() => navigate('/transfers')}
                                    className="flex flex-col items-center gap-2 min-w-[80px] group"
                                >
                                    <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 group-hover:border-primary group-hover:text-primary transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                                        <Plus className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-500 group-hover:text-primary transition-colors">New</span>
                                </button>
                                {recentContacts.map((contact, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleQuickTransfer(contact.name)}
                                        className="flex flex-col items-center gap-2 min-w-[80px] group"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden ring-2 ring-transparent group-hover:ring-primary/20 transition-all border border-slate-200 dark:border-slate-800">
                                            {contact.avatar ? (
                                                <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                                    <User className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate w-full text-center group-hover:text-primary transition-colors">
                                            {contact.name.split(' ')[0]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* My Cards */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">My Cards</h3>
                            <button onClick={() => navigate('/wallets')} className="text-xs font-bold text-slate-500 hover:text-primary transition-colors">Manage Cards</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Main Checking Card */}
                            <div 
                                onClick={() => navigate(`/wallets/${accounts[0].id}`)}
                                className="relative bg-slate-900 text-white rounded-[1.5rem] p-5 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between aspect-[1.586/1] shadow-xl hover:shadow-2xl overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
                                <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                                
                                <div className="flex justify-between items-start relative z-10">
                                    <div>
                                        <span className="font-bold text-white text-sm tracking-wide">Main Checking</span>
                                        <div className="w-8 h-6 bg-white/20 border border-white/10 rounded mt-2 opacity-80 backdrop-blur-md"></div>{/* Chip */}
                                    </div>
                                    <span className="font-black italic text-xl tracking-widest opacity-90">VISA</span>
                                </div>
                                <div className="relative z-10 mt-auto">
                                    <p className="font-mono text-slate-300 tracking-[0.2em] text-sm mb-1 drop-shadow-md">•••• •••• •••• {accounts[0].cardLast4}</p>
                                    <div className="flex justify-between items-end">
                                        <h3 className="text-xl font-bold tracking-tight">₦{accounts[0].balance.toLocaleString('en-NG')}</h3>
                                        <div className="text-right">
                                            <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Exp</span>
                                            <span className="text-xs font-mono font-medium text-slate-200">{accounts[0].cardExpiry}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Savings Card */}
                            <div 
                                onClick={() => navigate(`/wallets/${accounts[1].id}`)}
                                className="relative bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-[1.5rem] p-5 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between aspect-[1.586/1] shadow-xl hover:shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700/50 group"
                            >
                                <div className="absolute top-0 right-1/2 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-green-500/5 rounded-full blur-3xl group-hover:bg-green-500/10 transition-colors pointer-events-none"></div>

                                <div className="flex justify-between items-start relative z-10">
                                    <div>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm tracking-wide">Savings</span>
                                        <div className="w-8 h-6 bg-slate-200/80 dark:bg-slate-700/80 border border-slate-300/50 dark:border-slate-600/50 rounded mt-2 opacity-80 backdrop-blur-md"></div>{/* Chip */}
                                    </div>
                                    <span className="font-bold text-slate-400 text-sm">Mastercard</span>
                                </div>
                                <div className="relative z-10 mt-auto">
                                    <p className="font-mono text-slate-500 dark:text-slate-300 tracking-[0.2em] text-sm mb-1 drop-shadow-sm">•••• •••• •••• {accounts[1].cardLast4}</p>
                                    <div className="flex justify-between items-end">
                                        <h3 className="text-xl font-bold tracking-tight">₦{accounts[1].balance.toLocaleString('en-NG')}</h3>
                                        <div className="text-right">
                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 font-bold text-[10px] backdrop-blur-sm shadow-sm">
                                                <ArrowUpRight className="w-3 h-3" />
                                                {accounts[1].trend} APY
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Recent Activity */}
                <div className="lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                        <button onClick={() => navigate('/transactions')} className="text-xs font-bold text-slate-500 hover:text-primary transition-colors">View All</button>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm min-h-[400px]">
                        <StateRenderer 
                            loading={loadingTransactions} 
                            error={errorTransactions} 
                            data={transactions} 
                            onRetry={refreshTransactions}
                            emptyMessage="No recent transactions found."
                        >
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {transactions?.slice(0, 6).map((tx) => (
                                    <div 
                                        key={tx.id} 
                                        onClick={() => setSelectedTransaction(tx)}
                                        className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                                tx.type === 'incoming' 
                                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                {tx.type === 'incoming' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-primary transition-colors line-clamp-1">{tx.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium">{formatDate(tx.date)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-bold text-sm block ${
                                                tx.type === 'incoming' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'
                                            }`}>
                                                {tx.type === 'incoming' ? '+' : '-'}₦{Math.abs(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                tx.status === 'success' ? 'text-green-500' : tx.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
                                            }`}>{tx.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </StateRenderer>
                    </div>
                </div>
            </div>

            <TransactionDetailsModal 
                transaction={selectedTransaction} 
                onClose={() => setSelectedTransaction(null)} 
            />
        </div>
    );
};

export default DashboardScreen;
    