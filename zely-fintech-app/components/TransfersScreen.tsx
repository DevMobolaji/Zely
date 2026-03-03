
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeftRight, Download, CreditCard, Landmark, CheckCircle2, Loader2, ChevronDown, RefreshCw, Send, Users, Wallet, Check, AlertCircle } from 'lucide-react';
import { accountsData } from '../utils/mockData';
import { useToast } from './ToastContext';
import { Account } from '../utils/types';

const MAX_TRANSFER_LIMIT = 1000000;

// Helper to format currency with commas
const formatCurrency = (value: string | number) => {
    if (!value) return '';
    const cleanVal = String(value).replace(/[^0-9.]/g, '');
    if (!cleanVal) return '';
    
    const parts = cleanVal.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
};

// Helper to get raw number from formatted string
const parseCurrency = (value: string) => {
    return value.replace(/,/g, '');
};

// Load Paystack Script
const loadPaystackScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if ((window as any).PaystackPop) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

interface AccountSelectProps {
    label: string;
    accounts: Account[];
    selectedId: string;
    onChange: (id: string) => void;
    disabled?: boolean;
}

const AccountSelect: React.FC<AccountSelectProps> = ({ label, accounts, selectedId, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedAccount = accounts.find(a => a.id === selectedId);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">{label}</label>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full bg-slate-50 dark:bg-slate-800 border ${isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 dark:border-slate-700'} rounded-xl p-4 flex items-center justify-between transition-all outline-none text-left disabled:opacity-60 disabled:cursor-not-allowed`}
            >
                {selectedAccount ? (
                    <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedAccount.name}</p>
                        <p className="text-xs font-medium text-slate-500">{selectedAccount.currency}{selectedAccount.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
                    </div>
                ) : (
                    <span className="text-slate-400 font-medium">Select an account</span>
                )}
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
                    {accounts.length > 0 ? (
                        accounts.map((acc) => (
                            <button
                                key={acc.id}
                                type="button"
                                onClick={() => { onChange(acc.id); setIsOpen(false); }}
                                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0 text-left group"
                            >
                                <div>
                                    <p className={`font-bold text-sm ${acc.id === selectedId ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{acc.name}</p>
                                    <p className="text-xs font-medium text-slate-500">{acc.currency}{acc.balance.toLocaleString('en-NG')}</p>
                                </div>
                                {acc.id === selectedId && <Check className="w-4 h-4 text-primary" />}
                            </button>
                        ))
                    ) : (
                        <div className="p-4 text-center text-sm text-slate-500">No accounts available</div>
                    )}
                </div>
            )}
        </div>
    );
};

const TransfersScreen: React.FC = () => {
    const location = useLocation();
    const { showToast } = useToast();
    const isFunding = location.pathname.includes('fund-wallet');
    
    // Tab State for Transfers (Internal vs P2P)
    const [transferType, setTransferType] = useState<'internal' | 'p2p'>('internal');

    // Transfer State
    const [sourceId, setSourceId] = useState(() => {
        const checking = accountsData.find(a => a.type === 'current');
        return checking ? checking.id : (accountsData[0]?.id || '');
    });
    
    const [destId, setDestId] = useState(() => {
        const savings = accountsData.find(a => a.type === 'savings');
        return savings ? savings.id : '';
    });

    const [p2pRecipient, setP2pRecipient] = useState('');
    const [amount, setAmount] = useState(''); // Stores raw numeric value
    const [displayAmount, setDisplayAmount] = useState(''); // Stores formatted string with commas
    const [transferStatus, setTransferStatus] = useState<'idle' | 'confirm' | 'processing' | 'success'>('idle');
    const [amountError, setAmountError] = useState<string | null>(null);
    const [lastTransaction, setLastTransaction] = useState<{ amount: string, recipient: string } | null>(null);

    // Funding State
    const [fundingMethod, setFundingMethod] = useState<'bank' | 'card'>('bank');
    const [fundStatus, setFundStatus] = useState<'idle' | 'processing' | 'success'>('idle');
    const [fundingAmount, setFundingAmount] = useState('');

    // Filter accounts based on transfer type rules
    const getSourceAccounts = () => {
        return accountsData.filter(acc => acc.type === 'current');
    };

    const getDestAccounts = () => {
        return accountsData.filter(acc => acc.type === 'savings');
    };

    const handleTypeChange = (type: 'internal' | 'p2p') => {
        setTransferType(type);
        setTransferStatus('idle');
        setAmountError(null);
        
        // Reset Source logic (Always Checking)
        const validSources = accountsData.filter(acc => acc.type === 'current');
        const newSourceId = validSources.length > 0 ? validSources[0].id : '';
        setSourceId(newSourceId);

        // Reset Dest Logic
        if (type === 'internal') {
            const validDests = accountsData.filter(acc => acc.type === 'savings');
            setDestId(validDests.length > 0 ? validDests[0].id : '');
        } else {
            setP2pRecipient('');
        }
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const rawValue = parseCurrency(val);
        
        if (val && !/^[0-9.,]+$/.test(val)) return;

        setAmount(rawValue);
        setDisplayAmount(formatCurrency(rawValue));
        
        if (Number(rawValue) > MAX_TRANSFER_LIMIT) {
            setAmountError(`Transfer limit exceeded (₦${MAX_TRANSFER_LIMIT.toLocaleString()})`);
        } else {
            setAmountError(null);
        }
    };

    const handleTransfer = () => {
        if (!amount || Number(amount) <= 0) {
            showToast('error', 'Please enter a valid amount');
            return;
        }
        if (Number(amount) > MAX_TRANSFER_LIMIT) {
             showToast('error', `Amount cannot exceed ₦${MAX_TRANSFER_LIMIT.toLocaleString()}`);
             return;
        }
        if (transferType === 'internal' && !destId) {
             showToast('error', 'Please select a destination savings account');
             return;
        }
        if (transferType === 'internal' && sourceId === destId) {
            showToast('error', 'Source and destination accounts cannot be the same');
            return;
        }
        if (transferType === 'p2p' && !p2pRecipient) {
            showToast('error', 'Recipient is required');
            return;
        }
        setTransferStatus('confirm');
    };

    const confirmTransfer = () => {
        setTransferStatus('processing');
        
        const finalRecipient = transferType === 'internal' ? getAccount(destId)?.name || 'Savings' : p2pRecipient;
        setLastTransaction({ amount, recipient: finalRecipient });

        setTimeout(() => {
            setTransferStatus('success');
            showToast('success', 'Transfer completed successfully');
            
             setAmount('');
             setDisplayAmount('');
             setP2pRecipient('');
        }, 1500);
    };

    const handleFunding = async () => {
        if (!fundingAmount || Number(fundingAmount) <= 0) {
            showToast('error', 'Please enter a valid amount to fund');
            return;
        }

        setFundStatus('processing');

        // Load Paystack Script
        const scriptLoaded = await loadPaystackScript();
        if (!scriptLoaded) {
            showToast('error', 'Failed to initialize payment provider. Please check your internet connection.');
            setFundStatus('idle');
            return;
        }

        // Initialize Paystack
        const paystack = new (window as any).PaystackPop();
        
        // Note: In a real app, this key should come from environment variables
        // Using a test public key
        const publicKey = 'pk_test_0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a'; 

        const handler = (window as any).PaystackPop.setup({
            key: publicKey, 
            email: 'user@example.com', // Replace with dynamic user email
            amount: Number(fundingAmount) * 100, // Amount in kobo
            currency: 'NGN',
            ref: 'fund_' + Math.floor((Math.random() * 1000000000) + 1), // Generate a random reference
            onClose: () => {
                setFundStatus('idle');
                showToast('error', 'Transaction cancelled.');
            },
            callback: (response: any) => {
                // Payment Successful
                // console.log(response); 
                // After success, you would typically call your backend to verify the transaction reference
                setTimeout(() => {
                    setFundStatus('success');
                    showToast('success', `Funding successful! Ref: ${response.reference}`);
                    setFundingAmount('');
                }, 1000);
            }
        });

        handler.openIframe();
    };

    const resetTransfer = () => {
        setTransferStatus('idle');
        setAmount('');
        setDisplayAmount('');
        setP2pRecipient('');
        setAmountError(null);
        setLastTransaction(null);
    };

    const getAccount = (id: string) => accountsData.find(a => a.id === id);

    if (isFunding) {
        return (
            <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
                            <Download className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-black">Fund Wallet</h2>
                    </div>

                    {fundStatus === 'success' ? (
                         <div className="text-center py-10 animate-in zoom-in duration-300">
                             <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-500 mb-6"><CheckCircle2 className="w-10 h-10" /></div>
                             <h3 className="text-2xl font-black mb-2">Funding Successful!</h3>
                             <p className="text-slate-500 mb-8">Your wallet has been credited.</p>
                             <button onClick={() => setFundStatus('idle')} className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl">Fund Again</button>
                         </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <button 
                                    onClick={() => setFundingMethod('bank')}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${fundingMethod === 'bank' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
                                >
                                    <Landmark className="w-6 h-6" />
                                    <span className="font-bold text-sm">Bank Transfer</span>
                                </button>
                                <button 
                                    onClick={() => setFundingMethod('card')}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${fundingMethod === 'card' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
                                >
                                    <CreditCard className="w-6 h-6" />
                                    <span className="font-bold text-sm">External Card</span>
                                </button>
                            </div>

                            {fundingMethod === 'bank' ? (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
                                    <p className="text-sm font-medium text-slate-500">Transfer to the following account to fund your wallet instantly.</p>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold uppercase text-slate-400">Bank Name</p>
                                        <p className="font-bold text-lg">Zely Partner Bank</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold uppercase text-slate-400">Account Number</p>
                                        <p className="font-mono font-black text-2xl tracking-wider">9900 2233 4455</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold uppercase text-slate-400">Beneficiary</p>
                                        <p className="font-bold text-lg">Zely / John Doe</p>
                                    </div>
                                    <div className="pt-4 flex items-center justify-center gap-2 text-xs font-bold text-yellow-600 bg-yellow-50 dark:bg-yellow-900/10 py-2 rounded-lg">
                                        <RefreshCw className="w-3 h-3 animate-spin" /> Waiting for transfer...
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 mb-2">Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                                            <input 
                                                type="number"
                                                value={fundingAmount}
                                                onChange={(e) => setFundingAmount(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 font-bold text-lg outline-none focus:ring-2 focus:ring-primary"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleFunding}
                                        disabled={fundStatus === 'processing'}
                                        className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {fundStatus === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Pay via Provider'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl min-h-[500px] flex flex-col">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600">
                        <ArrowLeftRight className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black">Transfer Money</h2>
                </div>

                {/* Transfer Type Tabs */}
                {transferStatus !== 'success' && transferStatus !== 'confirm' && (
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-8">
                        <button 
                            onClick={() => handleTypeChange('internal')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${transferType === 'internal' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Wallet className="w-4 h-4" /> Internal Transfer
                        </button>
                        <button 
                            onClick={() => handleTypeChange('p2p')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${transferType === 'p2p' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <Users className="w-4 h-4" /> P2P Transfer
                        </button>
                    </div>
                )}

                {transferStatus === 'success' ? (
                     <div className="text-center py-10 flex-1 flex flex-col items-center justify-center animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-500 mb-6"><CheckCircle2 className="w-10 h-10" /></div>
                        <h3 className="text-2xl font-black mb-2">Transfer Complete!</h3>
                        <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                            You successfully transferred <span className="font-bold text-slate-900 dark:text-white">₦{lastTransaction ? Number(lastTransaction.amount).toLocaleString() : '0.00'}</span> to <span className="font-bold text-slate-900 dark:text-white">{lastTransaction?.recipient}</span>.
                        </p>
                        <button onClick={resetTransfer} className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl w-full hover:scale-105 transition-transform">Make Another Transfer</button>
                    </div>
                ) : transferStatus === 'confirm' ? (
                    // Confirmation Step (In-place Modal/Wizard Step)
                    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex-1 space-y-6">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Review Transaction</h3>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500 font-medium">Source Account</span>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{getAccount(sourceId)?.name}</p>
                                            <p className="text-xs text-slate-400">Balance: {getAccount(sourceId)?.currency}{getAccount(sourceId)?.balance.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500 font-medium">Destination</span>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                {transferType === 'internal' ? getAccount(destId)?.name : p2pRecipient}
                                            </p>
                                            {transferType === 'internal' && <p className="text-xs text-slate-400">Savings</p>}
                                            {transferType === 'p2p' && <p className="text-xs text-slate-400">Zely User</p>}
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-slate-200 dark:bg-slate-700"></div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500 font-medium">Amount</span>
                                        <span className="text-base font-bold text-slate-900 dark:text-white">₦{Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500 font-medium">Transaction Fee</span>
                                        <span className="text-base font-bold text-green-500">Free</span>
                                    </div>

                                    <div className="w-full h-px bg-slate-200 dark:bg-slate-700"></div>

                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-base font-bold text-slate-900 dark:text-white">Total Debit</span>
                                        <span className="text-2xl font-black text-slate-900 dark:text-white">₦{Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setTransferStatus('idle')} className="flex-1 py-4 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Edit
                            </button>
                            <button onClick={confirmTransfer} className="flex-[2] py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5" /> Confirm Transfer
                            </button>
                        </div>
                    </div>
                ) : (
                    // Input Form
                    <div className="space-y-6 flex-1">
                        {/* Source Account Custom Dropdown */}
                        <AccountSelect 
                            label="From Account"
                            accounts={getSourceAccounts()}
                            selectedId={sourceId}
                            onChange={(id) => {
                                setSourceId(id);
                                // If internal, reset dest if it matches new source
                                if (transferType === 'internal' && id === destId) {
                                    setDestId('');
                                }
                            }}
                        />

                        {/* Destination */}
                        <div className="space-y-2">
                            {transferType === 'internal' ? (
                                <AccountSelect 
                                    label="To Account"
                                    accounts={getDestAccounts()}
                                    selectedId={destId}
                                    onChange={setDestId}
                                />
                            ) : (
                                <>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">To Recipient</label>
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            value={p2pRecipient}
                                            onChange={(e) => setP2pRecipient(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 pl-4 pr-10 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:font-normal placeholder:text-slate-400"
                                            placeholder="Enter User ID, Email, or Phone"
                                        />
                                        <Users className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 ml-1">Instant transfer to any Zely user.</p>
                                </>
                            )}
                        </div>

                        {/* Amount */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm font-bold text-slate-500">Amount</label>
                                <span className="text-xs font-bold text-slate-400">Limit: ₦{MAX_TRANSFER_LIMIT.toLocaleString()}</span>
                            </div>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                                <input 
                                    type="text"
                                    value={displayAmount}
                                    onChange={handleAmountChange}
                                    className={`w-full bg-slate-50 dark:bg-slate-800 border ${amountError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl py-3 pl-12 pr-4 font-bold text-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300`}
                                    placeholder="0.00"
                                    disabled={transferStatus !== 'idle'}
                                />
                            </div>
                            {amountError && (
                                <div className="flex items-center gap-1 mt-2 text-red-500 text-xs font-bold animate-pulse">
                                    <AlertCircle className="w-3 h-3" />
                                    {amountError}
                                </div>
                            )}
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={handleTransfer}
                                disabled={!amount || !!amountError || transferStatus === 'processing' || (transferType === 'internal' && !destId) || (transferType === 'p2p' && !p2pRecipient)}
                                className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/25 disabled:shadow-none"
                            >
                                {transferStatus === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Review Transfer'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransfersScreen;
