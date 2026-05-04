
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, Plus, ChevronRight, Copy, History as HistoryIcon } from 'lucide-react';
import { accountsData as initialAccounts, generateMockData } from '../../utils/mockData';
import { useToast } from '../../context/ToastContext';
import { Account } from '../../utils/types';

const WalletsScreen: React.FC = () => {
    const { walletId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
    
    // API Call Preparation (Commented out for production use later)
    /*
    useEffect(() => {
        const fetchWallets = async () => {
            try {
                // const response = await fetch('/api/user/wallets');
                // if(response.ok) {
                //    const data = await response.json();
                //    setAccounts(data);
                // }
            } catch (error) {
                console.error("Failed to load wallets", error);
            }
        };
        fetchWallets();
    }, []);
    */

    const transactions = React.useMemo(() => {
        // Mocking generating transaction based on wallet ID conceptually
        // In a real app, this would be filtered from a transaction store
        return generateMockData();
    }, []);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('success', 'Copied to clipboard');
    };

    // If walletId is present, show details
    if (walletId) {
        const wallet = accounts.find(a => a.id === walletId) || accounts[0];

        return (
            <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
                <button onClick={() => navigate('/wallets')} className="text-sm font-bold text-slate-500 hover:text-primary flex items-center gap-1">
                    ← Back to Wallets
                </button>
                
                <div className="bg-slate-900 text-white rounded-[2rem] p-8 relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                                {wallet.type === 'crypto' ? <Wallet className="w-6 h-6 text-white" /> : <CreditCard className="w-6 h-6 text-white" />}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">{wallet.type}</span>
                            </div>
                        </div>
                        <h2 className="text-slate-300 font-bold mb-1">{wallet.name}</h2>
                        <h1 className="text-4xl font-black mb-6">{wallet.currency}{wallet.balance.toLocaleString('en-NG')}</h1>
                        
                        <div className="flex gap-3">
                            <button onClick={() => navigate('/fund-wallet')} className="flex-1 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] duration-200">
                                <ArrowDownLeft className="w-4 h-4" /> Fund
                            </button>
                            <button onClick={() => navigate('/transfers')} className="flex-1 py-3 bg-white/10 text-white backdrop-blur-md border border-white/10 rounded-xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] duration-200">
                                <ArrowUpRight className="w-4 h-4" /> Transfer
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold mb-4">Account Details</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Account Number</p>
                                    <p className="font-mono font-bold">{wallet.number}</p>
                                </div>
                                <button onClick={() => handleCopy(wallet.number)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"><Copy className="w-4 h-4 text-slate-400" /></button>
                            </div>
                             {wallet.iban && (
                                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">IBAN</p>
                                        <p className="font-mono font-bold truncate max-w-[200px]">{wallet.iban}</p>
                                    </div>
                                    <button onClick={() => handleCopy(wallet.iban!)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"><Copy className="w-4 h-4 text-slate-400" /></button>
                                </div>
                            )}
                            {wallet.cardExpiry && (
                                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Card Expiry</p>
                                        <p className="font-mono font-bold">{wallet.cardExpiry}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                         <h3 className="font-bold mb-4">Ledger Summary</h3>
                         <div className="space-y-3">
                             <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Total In</span>
                                <span className="text-sm font-bold text-green-500">+₦1,245,000.00</span>
                             </div>
                             <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Total Out</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">-₦823,050.00</span>
                             </div>
                             <div className="w-full h-px bg-slate-100 dark:bg-slate-800"></div>
                             <div className="flex justify-between">
                                <span className="text-sm font-bold">Net Flow</span>
                                <span className="text-sm font-bold text-blue-500">+₦421,950.00</span>
                             </div>
                         </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2"><HistoryIcon className="w-5 h-5 text-slate-400" /> Recent Transactions</h3>
                    </div>
                    <div>
                        {transactions.slice(0, 5).map((tx: any) => (
                            <div key={tx.id} className="p-4 border-b border-slate-50 dark:border-slate-800 last:border-0 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{tx.title}</p>
                                    <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString()}</p>
                                </div>
                                <span className={`text-sm font-bold ${tx.type === 'incoming' ? 'text-green-500' : 'text-slate-900 dark:text-white'}`}>
                                    {tx.type === 'incoming' ? '+' : '-'}₦{Math.abs(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // List View
    return (
        <div className="w-full max-w-[1920px] mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Wallets</h2>
                <button className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                    <Plus className="w-4 h-4" /> Create Wallet
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((acc) => (
                    <div 
                        key={acc.id} 
                        onClick={() => navigate(`/wallets/${acc.id}`)}
                        className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-8">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    acc.type === 'crypto' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 
                                    acc.type === 'savings' ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' :
                                    'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                }`}>
                                    {acc.type === 'crypto' ? <Wallet className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                                </div>
                                <div className="text-right">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${
                                        acc.type === 'virtual' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 
                                        acc.type === 'savings' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                        {acc.type}
                                    </span>
                                </div>
                            </div>

                            <h4 className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">{acc.name}</h4>
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-black">{acc.currency}{acc.balance.toLocaleString('en-NG')}</h3>
                            </div>
                            
                            <div className="mt-6 flex items-center justify-between text-xs font-bold text-primary group-hover:underline">
                                <span>View Details</span>
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WalletsScreen;
