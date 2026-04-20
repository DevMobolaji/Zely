
import React, { useState, useEffect } from 'react';
import { X, Loader2, Send, CheckCircle2, ChevronDown, Search, User, AlertCircle } from 'lucide-react';
import { accountsData } from '../../../utils/mockData';
import { Transaction } from '../../../utils/types';

const MAX_SEND_LIMIT = 1000000;

interface SendMoneyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (recipient: string, amount: string, senderAccount: any) => void;
}

const SendMoneyModal: React.FC<SendMoneyModalProps> = ({ isOpen, onClose, onSend }) => {
    const [sendRecipient, setSendRecipient] = useState('');
    const [sendAmount, setSendAmount] = useState('');
    const [sendStep, setSendStep] = useState<'input' | 'confirm' | 'processing'>('input');
    const [senderAccountIndex, setSenderAccountIndex] = useState(0);
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const [sendErrors, setSendErrors] = useState<{ recipient?: string, amount?: string }>({});
    
    // Search State
    const [isSearching, setIsSearching] = useState(false);
    const [foundUser, setFoundUser] = useState<{ name: string, email: string, avatar: string } | null>(null);

    // Mock Database of users for search simulation
    const mockRecipients = [
        { name: 'Sarah Smith', email: 'sarah@example.com', avatar: 'Sarah' },
        { name: 'Mike Johnson', email: 'mike@example.com', avatar: 'Mike' },
        { name: 'Anna Davis', email: 'anna@example.com', avatar: 'Anna' },
        { name: 'James Wilson', email: 'james@example.com', avatar: 'James' },
        { name: 'Dad', email: 'dad@family.com', avatar: 'Dad' },
        { name: 'Mom', email: 'mom@family.com', avatar: 'Mom' },
    ];

    useEffect(() => {
        const query = sendRecipient.trim();
        if (!query) {
            setFoundUser(null);
            setIsSearching(false);
            return;
        }

        if (query.length < 2) {
            setIsSearching(false);
            setFoundUser(null);
            return;
        }

        setIsSearching(true);
        setFoundUser(null);

        const timer = setTimeout(() => {
            const match = mockRecipients.find(r => 
                r.name.toLowerCase().includes(query.toLowerCase()) || 
                r.email.toLowerCase().includes(query.toLowerCase())
            );
            
            if (match) {
                setFoundUser(match);
            }
            setIsSearching(false);
        }, 800);

        return () => clearTimeout(timer);
    }, [sendRecipient]);

    if (!isOpen) return null;

    const handleSendInputSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errors: { recipient?: string, amount?: string } = {};
        const amountNum = Number(sendAmount);
        
        if (!sendRecipient.trim()) errors.recipient = "Recipient is required";
        if (!sendAmount || amountNum <= 0) errors.amount = "Please enter a valid amount";
        if (amountNum > MAX_SEND_LIMIT) errors.amount = `Amount cannot exceed ₦${MAX_SEND_LIMIT.toLocaleString()}`;
        
        if (Object.keys(errors).length > 0) {
            setSendErrors(errors);
            return;
        }
        setSendErrors({});
        setSendStep('confirm');
    };

    const handleConfirmSend = () => {
        setSendStep('processing');
        setTimeout(() => {
            // Instead of showing success internally, we trigger the callback
            // The parent component (DashboardScreen) will handle closing this modal 
            // and showing the TransactionSuccessModal
            onSend(foundUser ? foundUser.name : sendRecipient, sendAmount, accountsData[senderAccountIndex]);
        }, 2000);
    };

    const resetModal = () => {
        onClose();
        setSendStep('input');
        setSendAmount('');
        setSendRecipient('');
        setFoundUser(null);
        setIsSearching(false);
        setSenderAccountIndex(0);
        setShowAccountDropdown(false);
        setSendErrors({});
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Send Money</h3>
                    <button onClick={resetModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                {sendStep === 'input' && (
                    <form onSubmit={handleSendInputSubmit} className="space-y-6">
                        <div className="relative">
                            <label className="block text-sm font-bold text-slate-500 mb-2">From Account</label>
                            <button
                                type="button"
                                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 flex items-center justify-between outline-none focus:ring-2 focus:ring-primary"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900 dark:text-white">{accountsData[senderAccountIndex].name}</span>
                                    <span className="text-xs text-slate-500">({accountsData[senderAccountIndex].currency}{accountsData[senderAccountIndex].balance.toLocaleString()})</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </button>
                            
                            {showAccountDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden">
                                    {accountsData.map((acc, index) => (
                                        <button
                                            key={acc.id}
                                            type="button"
                                            onClick={() => { setSenderAccountIndex(index); setShowAccountDropdown(false); }}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                                        >
                                            <span className="font-medium text-sm text-slate-900 dark:text-white">{acc.name}</span>
                                            <span className="text-xs font-bold text-slate-500">{acc.currency}{acc.balance.toLocaleString()}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-2">Recipient</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={sendRecipient} 
                                    onChange={(e) => setSendRecipient(e.target.value)} 
                                    className={`w-full bg-slate-50 dark:bg-slate-800 border ${sendErrors.recipient ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl py-3 pl-4 pr-12 font-semibold outline-none focus:ring-2 focus:ring-primary transition-all`} 
                                    placeholder="Enter name or email"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    {isSearching ? (
                                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 pl-2">
                                            <Search className="w-3 h-3 text-slate-400" />
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        </div>
                                    ) : foundUser ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    ) : null}
                                </div>
                            </div>
                            
                            {/* Found User Card */}
                            {foundUser && (
                                <div className="mt-2 flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-white dark:border-slate-600 shadow-sm shrink-0">
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${foundUser.avatar}`} alt={foundUser.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{foundUser.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{foundUser.email}</p>
                                    </div>
                                    <div className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase rounded-md">
                                        Verified
                                    </div>
                                </div>
                            )}

                            {sendErrors.recipient && <p className="text-xs text-red-500 mt-1">{sendErrors.recipient}</p>}
                        </div>
                        
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm font-bold text-slate-500">Amount</label>
                                <span className="text-xs font-bold text-slate-400">Limit: ₦{MAX_SEND_LIMIT.toLocaleString()}</span>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                                <input 
                                    type="number" 
                                    value={sendAmount} 
                                    onChange={(e) => setSendAmount(e.target.value)} 
                                    className={`w-full bg-slate-50 dark:bg-slate-800 border ${sendErrors.amount ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl py-3 pl-8 pr-4 font-bold text-lg outline-none focus:ring-2 focus:ring-primary`} 
                                    placeholder="0.00"
                                />
                            </div>
                            {sendErrors.amount && (
                                <div className="flex items-center gap-1 mt-1 text-red-500 text-xs font-bold animate-pulse">
                                    <AlertCircle className="w-3 h-3" />
                                    {sendErrors.amount}
                                </div>
                            )}
                        </div>
                        <button type="submit" className="w-full py-3.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-colors">Continue</button>
                    </form>
                )}
                {sendStep === 'confirm' && (
                    <div className="text-center space-y-6">
                        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-primary relative">
                            <Send className="w-10 h-10 ml-1" />
                            {foundUser && (
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 overflow-hidden bg-slate-200">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${foundUser.avatar}`} alt={foundUser.name} className="w-full h-full" />
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Sending to</p>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                                {foundUser ? foundUser.name : sendRecipient}
                            </h3>
                            {foundUser && <p className="text-xs text-slate-400">{foundUser.email}</p>}
                            <h2 className="text-4xl font-black mt-4">₦{Number(sendAmount).toFixed(2)}</h2>
                            <p className="text-xs text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/50 inline-block px-3 py-1 rounded-full">
                                From: {accountsData[senderAccountIndex].name} •••• {accountsData[senderAccountIndex].cardLast4 || 'Wallet'}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setSendStep('input')} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800">Back</button>
                            <button onClick={handleConfirmSend} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light shadow-lg shadow-primary/25">Confirm Send</button>
                        </div>
                    </div>
                )}
                {sendStep === 'processing' && <div className="text-center py-10"><Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" /><p className="font-bold text-lg">Processing Transaction...</p></div>}
            </div>
        </div>
    );
};

export default SendMoneyModal;
