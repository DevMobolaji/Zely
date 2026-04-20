
import React, { useState, useEffect, useRef } from 'react';
import { PiggyBank, Plus, Lock, Unlock, CalendarClock, MoreHorizontal, Target, X, Check, AlertCircle, ChevronDown, Wallet, Loader2, Trash2, ArrowDownLeft, CheckCircle2, PartyPopper, ArrowRight, Pencil, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { accountsData } from '../../utils/mockData';
import { Account } from '../../utils/types';

interface SavingsGoal {
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    locked: boolean;
    autoSave: boolean;
    deadline: string;
    category: 'car' | 'emergency' | 'vacation' | 'gadget' | 'home' | 'other';
}

// Helper to format currency with commas
const formatCurrency = (value: string | number) => {
    if (!value) return '';
    const cleanVal = String(value).replace(/[^0-9.]/g, '');
    if (!cleanVal) return '';
    const parts = cleanVal.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
};

const parseCurrency = (value: string) => {
    return value.replace(/,/g, '');
};

interface AccountSelectProps {
    label: string;
    accounts: Account[];
    selectedId: string;
    onChange: (id: string) => void;
}

const AccountSelect: React.FC<AccountSelectProps> = ({ label, accounts, selectedId, onChange }) => {
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
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-slate-50 dark:bg-slate-800 border ${isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 dark:border-slate-700'} rounded-xl p-4 flex items-center justify-between transition-all outline-none text-left`}
            >
                {selectedAccount ? (
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
                            <Wallet className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedAccount.name}</p>
                            <p className="text-xs font-medium text-slate-500">{selectedAccount.currency}{selectedAccount.balance.toLocaleString('en-NG')}</p>
                        </div>
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
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${acc.id === selectedId ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className={`font-bold text-sm ${acc.id === selectedId ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{acc.name}</p>
                                        <p className="text-xs font-medium text-slate-500">{acc.currency}{acc.balance.toLocaleString('en-NG')}</p>
                                    </div>
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

const SavingsScreen: React.FC = () => {
    const { showToast } = useToast();

    // State
    const [goals, setGoals] = useState<SavingsGoal[]>([
        { id: '1', title: 'New Car', targetAmount: 2500000, currentAmount: 1250000, locked: true, autoSave: true, deadline: '2024-12-31', category: 'car' },
        { id: '2', title: 'Emergency Fund', targetAmount: 1000000, currentAmount: 820000, locked: false, autoSave: false, deadline: '2024-06-01', category: 'emergency' },
        { id: '3', title: 'Vacation', targetAmount: 500000, currentAmount: 120000, locked: false, autoSave: true, deadline: '2024-08-15', category: 'vacation' },
        { id: '4', title: 'MacBook Pro', targetAmount: 2000000, currentAmount: 2000000, locked: false, autoSave: false, deadline: '2024-05-01', category: 'gadget' },
    ]);

    // Modals State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeTopUpGoal, setActiveTopUpGoal] = useState<SavingsGoal | null>(null);
    const [completedGoal, setCompletedGoal] = useState<SavingsGoal | null>(null);
    const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null); // State for delete confirmation

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editTarget, setEditTarget] = useState('');
    const [editDeadline, setEditDeadline] = useState('');
    const [editAutoSave, setEditAutoSave] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Create Goal Form State
    const [newGoalTitle, setNewGoalTitle] = useState('');
    const [newGoalTarget, setNewGoalTarget] = useState('');
    const [newGoalDeadline, setNewGoalDeadline] = useState('');
    const [newGoalAutoSave, setNewGoalAutoSave] = useState(false);
    const [newGoalLocked, setNewGoalLocked] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Top Up Form State
    const [topUpAmount, setTopUpAmount] = useState('');
    const [sourceAccountId, setSourceAccountId] = useState(accountsData[0].id);
    const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

    // --- Handlers ---

    const toggleLock = (id: string) => {
        setGoals(prev => prev.map(g => g.id === id ? { ...g, locked: !g.locked } : g));
        const goal = goals.find(g => g.id === id);
        showToast('success', `Goal ${goal?.locked ? 'unlocked' : 'locked'} successfully`);
    };

    const handleDeleteClick = (goal: SavingsGoal) => {
        setGoalToDelete(goal);
    };

    const executeDeleteGoal = () => {
        if (!goalToDelete) return;

        if (goalToDelete.currentAmount > 0) {
            showToast('success', `Goal deleted. ₦${goalToDelete.currentAmount.toLocaleString()} returned to wallet.`);
        } else {
            showToast('success', 'Savings goal deleted.');
        }

        setGoals(prev => prev.filter(g => g.id !== goalToDelete.id));
        setGoalToDelete(null);
    };

    const handleRedeemGoal = (goalId: string) => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;

        // Simulate API call to move money
        setGoals(prev => prev.map(g => {
            if (g.id === goalId) {
                return { ...g, currentAmount: 0 };
            }
            return g;
        }));

        showToast('success', `Congratulations! ₦${goal.currentAmount.toLocaleString()} moved to Main Checking.`);
    };

    const confirmGoalCompletion = () => {
        if (!completedGoal) return;

        // 1. Delete the goal
        setGoals(prev => prev.filter(g => g.id !== completedGoal.id));

        // 2. Close modal
        setCompletedGoal(null);

        // 3. Show Success Toast simulating the transfer
        showToast('success', `Goal Reached! ₦${completedGoal.currentAmount.toLocaleString()} transferred to Main Checking.`);
    };

    const handleCreateGoal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGoalTitle || !newGoalTarget || !newGoalDeadline) {
            showToast('error', 'Please fill in all fields');
            return;
        }

        setIsCreating(true);
        const targetAmount = Number(parseCurrency(newGoalTarget));

        setTimeout(() => {
            const newGoal: SavingsGoal = {
                id: Date.now().toString(),
                title: newGoalTitle,
                targetAmount: targetAmount,
                currentAmount: 0,
                locked: newGoalLocked,
                autoSave: newGoalAutoSave,
                deadline: newGoalDeadline,
                category: 'other'
            };

            setGoals([...goals, newGoal]);
            setIsCreating(false);
            setIsCreateModalOpen(false);

            // Reset Form
            setNewGoalTitle('');
            setNewGoalTarget('');
            setNewGoalDeadline('');
            setNewGoalAutoSave(false);
            setNewGoalLocked(false);

            showToast('success', 'New savings goal created!');
        }, 1500);
    };

    const handleEditClick = (goal: SavingsGoal) => {
        setEditingGoal(goal);
        setEditTitle(goal.title);
        setEditTarget(formatCurrency(goal.targetAmount));
        setEditDeadline(goal.deadline);
        setEditAutoSave(goal.autoSave);
        setIsEditModalOpen(true);
    };

    const handleUpdateGoal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGoal) return;

        setIsUpdating(true);
        setTimeout(() => {
            setGoals(prev => prev.map(g => {
                if (g.id === editingGoal.id) {
                    return {
                        ...g,
                        title: editTitle,
                        targetAmount: Number(parseCurrency(editTarget)),
                        deadline: editDeadline,
                        autoSave: editAutoSave
                    };
                }
                return g;
            }));
            setIsUpdating(false);
            setIsEditModalOpen(false);
            setEditingGoal(null);
            showToast('success', 'Goal updated successfully');
        }, 1000);
    };

    const handleTopUp = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTopUpGoal) return;

        const amount = Number(parseCurrency(topUpAmount));
        const sourceAccount = accountsData.find(a => a.id === sourceAccountId);

        if (!amount || amount <= 0) {
            showToast('error', 'Please enter a valid amount');
            return;
        }

        if (sourceAccount && sourceAccount.balance < amount) {
            showToast('error', 'Insufficient funds in source account');
            return;
        }

        setIsProcessingTopUp(true);

        setTimeout(() => {
            let updatedGoal: SavingsGoal | null = null;
            let goalReached = false;

            const currentGoal = goals.find(g => g.id === activeTopUpGoal.id);
            if (currentGoal) {
                const newAmount = currentGoal.currentAmount + amount;
                if (newAmount >= currentGoal.targetAmount) {
                    goalReached = true;
                    updatedGoal = { ...currentGoal, currentAmount: newAmount };
                } else {
                    updatedGoal = { ...currentGoal, currentAmount: newAmount };
                }
            }

            if (updatedGoal) {
                const finalGoal = updatedGoal; // Capture for closure
                setGoals(prev => prev.map(g => g.id === activeTopUpGoal.id ? finalGoal : g));

                if (goalReached) {
                    setCompletedGoal(finalGoal);
                } else {
                    showToast('success', `Successfully added ₦${amount.toLocaleString()} to ${activeTopUpGoal.title}`);
                }
            }

            setIsProcessingTopUp(false);
            setActiveTopUpGoal(null);
            setTopUpAmount('');
        }, 1500);
    };

    return (
        <div className="w-full max-w-[1920px] mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Savings Goals</h2>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary/25"
                >
                    <Plus className="w-4 h-4" /> New Goal
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {goals.map(goal => {
                    const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                    const isCompleted = goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0;

                    return (
                        <div key={goal.id} className={`bg-white dark:bg-slate-900 rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group hover:shadow-lg ${isCompleted ? 'border-green-500/50 shadow-green-500/10' : 'border-slate-100 dark:border-slate-800 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${isCompleted ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : goal.locked ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'bg-primary/10 text-primary'}`}>
                                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : goal.locked ? <Lock className="w-6 h-6" /> : <PiggyBank className="w-6 h-6" />}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditClick(goal)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-primary"
                                        title="Edit Goal"
                                    >
                                        <Pencil className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(goal)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-full transition-colors text-slate-400"
                                        title="Delete Goal"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{goal.title}</h3>
                            <p className="text-xs text-slate-500 font-bold mb-4">Target: ₦{goal.targetAmount.toLocaleString()}</p>

                            <div className="flex items-end gap-1 mb-2">
                                <span className={`text-3xl font-black ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>₦{goal.currentAmount.toLocaleString()}</span>
                                <span className="text-xs font-bold text-slate-400 mb-1.5">saved</span>
                            </div>

                            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
                                <div className={`h-full rounded-full transition-all duration-1000 ease-out ${progress >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                                {goal.autoSave && !isCompleted && (
                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <CalendarClock className="w-3.5 h-3.5" /> Auto-save on
                                    </div>
                                )}
                                <div className="flex items-center gap-1">
                                    <Target className="w-3.5 h-3.5" /> {new Date(goal.deadline).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                                {isCompleted ? (
                                    <button
                                        onClick={() => handleRedeemGoal(goal.id)}
                                        className="w-full py-3 text-sm font-bold bg-green-500 text-white hover:bg-green-600 rounded-xl transition-colors shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
                                    >
                                        <ArrowDownLeft className="w-4 h-4" /> Redeem to Wallet
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => toggleLock(goal.id)} className="flex-1 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-300">
                                            {goal.locked ? 'Unlock' : 'Lock'} Funds
                                        </button>
                                        <button
                                            onClick={() => setActiveTopUpGoal(goal)}
                                            className="flex-1 py-2 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                                        >
                                            Top Up
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- Delete Confirmation Modal --- */}
            {goalToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/10">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Delete Goal?</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">
                            Are you sure you want to delete <strong>{goalToDelete.title}</strong>?
                        </p>

                        {goalToDelete.currentAmount > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl mb-6 border border-yellow-100 dark:border-yellow-900/20 text-left">
                                <p className="text-sm font-bold text-yellow-700 dark:text-yellow-500 flex items-center gap-2">
                                    <Wallet className="w-4 h-4" /> Funds will be returned
                                </p>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    ₦{goalToDelete.currentAmount.toLocaleString()} will be moved to your Main Checking account.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setGoalToDelete(null)}
                                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeDeleteGoal}
                                className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/25"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Goal Completion Modal --- */}
            {completedGoal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-500"></div>
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/10">
                            <PartyPopper className="w-10 h-10 text-green-500 animate-bounce" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Goal Reached!</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">
                            You've hit your target for <strong>{completedGoal.title}</strong>!
                        </p>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-6 flex items-center justify-between border border-slate-100 dark:border-slate-800">
                            <div className="text-left">
                                <span className="text-xs text-slate-400 uppercase font-bold">Total Saved</span>
                                <p className="text-xl font-black text-slate-900 dark:text-white">₦{completedGoal.currentAmount.toLocaleString()}</p>
                            </div>
                            <ArrowRight className="text-slate-300" />
                            <div className="text-right">
                                <span className="text-xs text-slate-400 uppercase font-bold">Transfer To</span>
                                <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-end gap-1"><Wallet className="w-3 h-3" /> Main Checking</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 mb-6">
                            Proceeding will move funds to your main wallet and remove this savings goal.
                        </p>

                        <button
                            onClick={confirmGoalCompletion}
                            className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform active:scale-[0.98]"
                        >
                            Confirm & Transfer Funds
                        </button>
                    </div>
                </div>
            )}

            {/* --- Create Goal Modal --- */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Create New Goal</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleCreateGoal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Goal Title</label>
                                <input
                                    type="text"
                                    value={newGoalTitle}
                                    onChange={(e) => setNewGoalTitle(e.target.value)}
                                    placeholder="e.g., New Laptop"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                                    <input
                                        type="text"
                                        value={newGoalTarget}
                                        onChange={(e) => setNewGoalTarget(formatCurrency(parseCurrency(e.target.value)))}
                                        placeholder="0.00"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Deadline</label>
                                <input
                                    type="date"
                                    value={newGoalDeadline}
                                    onChange={(e) => setNewGoalDeadline(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-slate-600 dark:text-slate-300"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer" onClick={() => setNewGoalAutoSave(!newGoalAutoSave)}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newGoalAutoSave ? 'bg-primary border-primary' : 'border-slate-400'}`}>
                                    {newGoalAutoSave && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Enable Auto-Save</p>
                                    <p className="text-xs text-slate-500">Automatically deduct 5% monthly</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer" onClick={() => setNewGoalLocked(!newGoalLocked)}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newGoalLocked ? 'bg-red-500 border-red-500' : 'border-slate-400'}`}>
                                    {newGoalLocked && <Lock className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Lock Funds</p>
                                    <p className="text-xs text-slate-500">Prevent withdrawals until target date</p>
                                </div>
                            </div>

                            {newGoalTarget && newGoalDeadline && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-4 animate-in fade-in slide-in-from-top-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Goal Summary</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                                        You are setting a goal to save <span className="font-black text-slate-900 dark:text-white">₦{newGoalTarget}</span> by <span className="font-black text-slate-900 dark:text-white">{new Date(newGoalDeadline).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>.
                                    </p>
                                    {newGoalLocked ? (
                                        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                                            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>
                                                <strong className="block mb-0.5">Strict Lock Enabled</strong>
                                                You will <u>not</u> be able to withdraw these funds until the target date, even in emergencies.
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <Unlock className="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>
                                                <strong className="block mb-0.5">Flexible Savings</strong>
                                                You can withdraw these funds at any time without penalty.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Goal'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Edit Goal Modal --- */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Edit Savings Goal</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleUpdateGoal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Goal Title</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                                    <input
                                        type="text"
                                        value={editTarget}
                                        onChange={(e) => setEditTarget(formatCurrency(parseCurrency(e.target.value)))}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Deadline</label>
                                <input
                                    type="date"
                                    value={editDeadline}
                                    onChange={(e) => setEditDeadline(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-slate-600 dark:text-slate-300"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer" onClick={() => setEditAutoSave(!editAutoSave)}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${editAutoSave ? 'bg-primary border-primary' : 'border-slate-400'}`}>
                                    {editAutoSave && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Enable Auto-Save</p>
                                    <p className="text-xs text-slate-500">Automatically deduct 5% monthly</p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isUpdating}
                                className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Top Up Modal --- */}
            {activeTopUpGoal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold">Top Up Goal</h3>
                                <p className="text-xs text-slate-500 font-medium">Adding funds to: <span className="text-primary">{activeTopUpGoal.title}</span></p>
                            </div>
                            <button onClick={() => setActiveTopUpGoal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleTopUp} className="space-y-4">
                            <div>
                                <AccountSelect
                                    label="From Account"
                                    accounts={accountsData.filter(a => a.type === 'current')}
                                    selectedId={sourceAccountId}
                                    onChange={setSourceAccountId}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount to Add</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                                    <input
                                        type="text"
                                        value={topUpAmount}
                                        onChange={(e) => setTopUpAmount(formatCurrency(parseCurrency(e.target.value)))}
                                        placeholder="0.00"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                                        autoFocus
                                    />
                                </div>
                                <div className="mt-2 flex justify-between text-xs font-bold text-slate-400">
                                    <span>Remaining to target:</span>
                                    <span>₦{Math.max(0, activeTopUpGoal.targetAmount - activeTopUpGoal.currentAmount).toLocaleString()}</span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isProcessingTopUp || !topUpAmount}
                                className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessingTopUp ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Top Up'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavingsScreen;
