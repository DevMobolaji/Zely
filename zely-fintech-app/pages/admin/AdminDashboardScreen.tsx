
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, CreditCard, Settings, LogOut, Bell, Search,
    MoreHorizontal, ChevronDown, CheckCircle2, AlertCircle, X, Loader2,
    Trash2, Edit2, Shield, User, ArrowUpRight, ArrowDownLeft, Filter, Download,
    Gauge, Calendar, Eye, Wallet, Clock, Activity, ChevronUp, History, Info,
    Menu, DollarSign, CheckSquare, Square, AlertTriangle, Lock, Globe, BellRing
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
//import { handleLogout as apiLogout } from '../../utils/api';

type UserStatus = 'active' | 'suspended' | 'pending';
type UserRole = 'user' | 'admin';

interface UserData {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    role: UserRole;
    joinedDate: string;
    avatarSeed: string;
    balance: number;
}

interface AdminTransaction {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    type: 'payment' | 'refund' | 'transfer' | 'credit';
    flow: 'in' | 'out';
    status: 'success' | 'failed' | 'pending';
    date: string;
}

// ... Mock Data ...
const generateMockUsers = (): UserData[] => [
    { id: '1', name: 'John Doe', email: 'john@example.com', status: 'active', role: 'user', joinedDate: '2023-01-15', avatarSeed: 'John', balance: 12450.00 },
    { id: '2', name: 'Alice Smith', email: 'alice@company.com', status: 'active', role: 'admin', joinedDate: '2022-11-20', avatarSeed: 'Alice', balance: 8500.50 },
    { id: '3', name: 'Bob Johnson', email: 'bob.j@provider.net', status: 'suspended', role: 'user', joinedDate: '2023-03-10', avatarSeed: 'Bob', balance: 120.00 },
    { id: '4', name: 'Emma Wilson', email: 'emma.w@studio.io', status: 'pending', role: 'user', joinedDate: '2023-10-05', avatarSeed: 'Emma', balance: 0.00 },
    { id: '5', name: 'Michael Brown', email: 'm.brown@corp.org', status: 'active', role: 'user', joinedDate: '2023-06-12', avatarSeed: 'Michael', balance: 45200.00 },
    { id: '6', name: 'Sarah Connor', email: 'sarah@skynet.com', status: 'active', role: 'user', joinedDate: '2023-08-29', avatarSeed: 'Sarah', balance: 9850.75 },
];

const generateMockTransactions = (): AdminTransaction[] => [
    { id: 'TX-1001', userId: '1', userName: 'John Doe', amount: 150.00, type: 'payment', flow: 'out', status: 'success', date: '2023-10-25T10:30:00' },
    { id: 'TX-1002', userId: '3', userName: 'Bob Johnson', amount: 49.99, type: 'payment', flow: 'out', status: 'failed', date: '2023-10-24T14:15:00' },
    { id: 'TX-1003', userId: '5', userName: 'Michael Brown', amount: 2500.00, type: 'transfer', flow: 'out', status: 'pending', date: '2023-10-24T09:00:00' },
    { id: 'TX-1004', userId: '2', userName: 'Alice Smith', amount: 12.50, type: 'refund', flow: 'in', status: 'success', date: '2023-10-23T16:45:00' },
    { id: 'TX-1005', userId: '6', userName: 'Sarah Connor', amount: 99.00, type: 'payment', flow: 'out', status: 'success', date: '2023-10-23T11:20:00' },
    { id: 'TX-1006', userId: '1', userName: 'John Doe', amount: 500.00, type: 'transfer', flow: 'in', status: 'success', date: '2023-10-22T13:10:00' },
];

const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
        active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
};

const AdminDashboardScreen: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    // Determine active tab from URL
    const getActiveTab = () => {
        const path = location.pathname;
        if (path.includes('/admin/users')) return 'users';
        if (path.includes('/admin/transactions')) return 'transactions';
        if (path.includes('/admin/wallet-funding')) return 'funds';
        if (path.includes('/admin/reconciliation')) return 'settings'; // mapping reconciliation to settings/placeholder for now
        return 'overview';
    };

    const activeTab = getActiveTab();

    const [users, setUsers] = useState<UserData[]>(generateMockUsers());
    const [transactions, setTransactions] = useState<AdminTransaction[]>(generateMockTransactions());
    const [searchQuery, setSearchQuery] = useState('');

    // Funds Management State
    const [fundsTab, setFundsTab] = useState<'single' | 'bulk'>('single');
    const [selectedUserForCredit, setSelectedUserForCredit] = useState<string>('');
    const [creditAmount, setCreditAmount] = useState('');
    const [selectedUsersForBulk, setSelectedUsersForBulk] = useState<string[]>([]);
    const [isProcessingFunds, setIsProcessingFunds] = useState(false);

    // Sorting State
    const [userSort, setUserSort] = useState<{ key: keyof UserData; order: 'asc' | 'desc' }>({ key: 'joinedDate', order: 'desc' });
    const [txSort, setTxSort] = useState<{ key: keyof AdminTransaction; order: 'asc' | 'desc' }>({ key: 'date', order: 'desc' });

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

    // User Modals
    const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
    const [isViewUserModalOpen, setIsViewUserModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserData | null>(null);
    const [viewedUser, setViewedUser] = useState<UserData | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<UserData>>({});

    const handleLogout = () => {
        //apiLogout();
        showToast('success', 'Logged out successfully');
    };

    const handleConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmModal({ isOpen: true, title, message, onConfirm });
    };

    const handleDeleteUser = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        handleConfirm('Delete User Account?', 'Irreversible action.', () => {
             setUsers(prev => prev.filter(u => u.id !== id));
             setConfirmModal(null);
             showToast('success', 'User deleted');
        });
    };

    const handleDeleteTransaction = (id: string, e: React.MouseEvent) => {
         e.stopPropagation();
         handleConfirm('Delete Transaction?', 'Cannot be undone.', () => {
             setTransactions(prev => prev.filter(t => t.id !== id));
             setConfirmModal(null);
             showToast('success', 'Transaction deleted');
         });
    };

    const handleSingleCredit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!selectedUserForCredit || !creditAmount) return;
        setIsProcessingFunds(true);
        setTimeout(() => {
             setUsers(prev => prev.map(u => u.id === selectedUserForCredit ? { ...u, balance: u.balance + Number(creditAmount)} : u));
             setIsProcessingFunds(false);
             setCreditAmount('');
             showToast('success', 'Funded successfully');
        }, 1000);
    };

    const handleBulkCredit = () => {
        if(selectedUsersForBulk.length === 0 || !creditAmount) return;
        setIsProcessingFunds(true);
        setTimeout(() => {
             setUsers(prev => prev.map(u => selectedUsersForBulk.includes(u.id) ? { ...u, balance: u.balance + Number(creditAmount)} : u));
             setIsProcessingFunds(false);
             setCreditAmount('');
             showToast('success', 'Bulk funded successfully');
        }, 1000);
    };
    
    const toggleUserSelection = (id: string) => setSelectedUsersForBulk(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleAllUsers = () => setSelectedUsersForBulk(selectedUsersForBulk.length === users.length ? [] : users.map(u => u.id));
    
    const handleViewUserClick = (u: UserData) => { setViewedUser(u); setIsViewUserModalOpen(true); };
    const handleSortUsers = (key: keyof UserData) => setUserSort(prev => ({ key, order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc' }));
    const handleSortTransactions = (key: keyof AdminTransaction) => setTxSort(prev => ({ key, order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc' }));

    const handleNav = (path: string) => {
        navigate(path);
        setSidebarOpen(false);
    };

    return (
        <div className="flex h-[100dvh] bg-slate-50 dark:bg-black text-slate-900 dark:text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="flex flex-col h-full p-6">
                    <div className="flex items-center justify-between mb-8 px-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary p-2 rounded-xl"><Shield className="w-6 h-6 text-white" /></div>
                            <span className="text-xl font-bold tracking-tight">AdminPanel</span>
                        </div>
                        <button className="lg:hidden" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
                    </div>

                    <nav className="space-y-2 flex-1">
                        {[
                            { path: '/admin', icon: LayoutDashboard, label: 'Overview', id: 'overview' },
                            { path: '/admin/users', icon: Users, label: 'Users', id: 'users' },
                            { path: '/admin/transactions', icon: CreditCard, label: 'Transactions', id: 'transactions' },
                            { path: '/admin/wallet-funding', icon: Wallet, label: 'Funds Management', id: 'funds' },
                            { path: '/admin/reconciliation', icon: Settings, label: 'Reconciliation', id: 'settings' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleNav(item.path)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === item.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors mt-auto">
                        <LogOut className="w-5 h-5" />
                        Log Out
                    </button>
                </div>
            </aside>

            {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}

            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-10">
                    <div className="flex items-center gap-4">
                        <button className="lg:hidden p-2 -ml-2" onClick={() => setSidebarOpen(true)}><Menu className="w-6 h-6" /></button>
                        <h1 className="text-xl font-bold capitalize">{activeTab === 'settings' ? 'Reconciliation' : activeTab.replace('funds', 'Funds Management')}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">A</div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 lg:p-10 no-scrollbar">
                    
                    {/* --- OVERVIEW TAB --- */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20' },
                                    { label: 'Volume', value: `$${transactions.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}`, icon: ArrowUpRight, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20' },
                                    { label: 'System Health', value: '99.9%', icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/20' },
                                    { label: 'Support Queue', value: '12', icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/20' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}><stat.icon className="w-6 h-6" /></div>
                                        <div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p><h3 className="text-2xl font-black">{stat.value}</h3></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- USERS TAB --- */}
                    {activeTab === 'users' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center"><h2 className="text-lg font-bold">User Management</h2><button className="bg-primary px-4 py-2 text-white font-bold rounded-lg text-sm flex items-center gap-2 hover:bg-primary-light transition-colors"><Users className="w-4 h-4" /> New User</button></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                                        <tr>
                                            {['name', 'status', 'role', 'joinedDate'].map((key) => (
                                                <th key={key} className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSortUsers(key as any)}>
                                                    <div className="flex items-center gap-2">{key.toUpperCase()}{userSort.key === key && (userSort.order === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                                                </th>
                                            ))}
                                            <th className="px-6 py-4 text-right">ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {users.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group" onClick={() => handleViewUserClick(user)}>
                                                <td className="px-6 py-4"><div className="flex items-center gap-3"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`} className="w-9 h-9 rounded-full bg-slate-100" /><div><p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{user.name}</p><p className="text-[10px] text-slate-500">{user.email}</p></div></div></td>
                                                <td className="px-6 py-4"><StatusBadge status={user.status} /></td>
                                                <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 capitalize">{user.role}</td>
                                                <td className="px-6 py-4 text-slate-500 text-xs">{user.joinedDate}</td>
                                                <td className="px-6 py-4 text-right"><div className="flex justify-end gap-1"><button onClick={(e) => { e.stopPropagation(); setIsEditUserModalOpen(true); setCurrentUser(user); setEditFormData(user); }} className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button><button onClick={(e) => handleDeleteUser(user.id, e)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- TRANSACTIONS TAB --- */}
                    {activeTab === 'transactions' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                <h2 className="text-lg font-bold">Transaction History</h2>
                                <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                    <Download className="w-4 h-4" /> Export
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                                        <tr>
                                            {['id', 'userName', 'type', 'amount', 'status', 'date'].map((key) => (
                                                <th key={key} className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSortTransactions(key as any)}>
                                                    <div className="flex items-center gap-2">{key === 'userName' ? 'USER' : key.toUpperCase()}{txSort.key === key && (txSort.order === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                                                </th>
                                            ))}
                                            <th className="px-6 py-4 text-right">ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {transactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{tx.id}</td>
                                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{tx.userName}</td>
                                                <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-bold capitalize text-slate-600 dark:text-slate-300">{tx.type}</span></td>
                                                <td className={`px-6 py-4 font-bold ${tx.flow === 'in' ? 'text-green-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {tx.flow === 'in' ? '+' : '-'}${tx.amount.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4"><StatusBadge status={tx.status} /></td>
                                                <td className="px-6 py-4 text-xs text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={(e) => handleDeleteTransaction(tx.id, e)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- FUNDS MANAGEMENT TAB --- */}
                    {activeTab === 'funds' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                                {['single', 'bulk'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setFundsTab(tab as 'single' | 'bulk')}
                                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${fundsTab === tab ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        {tab === 'single' ? 'Single Credit' : 'Bulk Distribution'}
                                    </button>
                                ))}
                            </div>

                            {fundsTab === 'single' ? (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 max-w-2xl">
                                    <h3 className="text-xl font-bold mb-6">Credit User Account</h3>
                                    <form onSubmit={handleSingleCredit} className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select User</label>
                                            <select
                                                value={selectedUserForCredit}
                                                onChange={(e) => setSelectedUserForCredit(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary appearance-none font-semibold"
                                            >
                                                <option value="">Select a user...</option>
                                                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input
                                                    type="number"
                                                    value={creditAmount}
                                                    onChange={(e) => setCreditAmount(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isProcessingFunds || !selectedUserForCredit || !creditAmount}
                                            className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isProcessingFunds ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Credit Funds'}
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                     <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                        <h3 className="text-xl font-bold">Bulk Distribution</h3>
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="number"
                                                    value={creditAmount}
                                                    onChange={(e) => setCreditAmount(e.target.value)}
                                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm font-bold w-32 focus:ring-2 focus:ring-primary outline-none"
                                                    placeholder="Amount"
                                                />
                                            </div>
                                            <button
                                                onClick={handleBulkCredit}
                                                disabled={isProcessingFunds || selectedUsersForBulk.length === 0 || !creditAmount}
                                                className="bg-primary px-4 py-2 text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
                                            >
                                                {isProcessingFunds ? 'Processing...' : `Distribute to ${selectedUsersForBulk.length}`}
                                            </button>
                                        </div>
                                    </div>
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                                            <tr>
                                                <th className="px-6 py-4 w-12">
                                                    <button onClick={toggleAllUsers} className="text-slate-400 hover:text-primary">
                                                        {selectedUsersForBulk.length === users.length ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                    </button>
                                                </th>
                                                <th className="px-6 py-4">User</th>
                                                <th className="px-6 py-4">Email</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {users.map(user => (
                                                <tr key={user.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedUsersForBulk.includes(user.id) ? 'bg-primary/5' : ''}`} onClick={() => toggleUserSelection(user.id)}>
                                                    <td className="px-6 py-4">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedUsersForBulk.includes(user.id) ? 'bg-primary border-primary text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                                            {selectedUsersForBulk.includes(user.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-bold">{user.name}</td>
                                                    <td className="px-6 py-4 text-slate-500">{user.email}</td>
                                                    <td className="px-6 py-4"><StatusBadge status={user.status} /></td>
                                                    <td className="px-6 py-4 font-mono">${user.balance.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Placeholder for Reconciliation/Settings */}
                    {activeTab === 'settings' && (
                         <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                                <Settings className="w-10 h-10 text-slate-400" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Reconciliation Tools</h2>
                            <p className="text-slate-500 max-w-md">Administrative tools for system reconciliation and settings would go here.</p>
                         </div>
                    )}
                </div>
            </main>
            
            {/* Modal Placeholders if needed - currently defined inside main component logic but not fully rendered in simplified view. 
                In a real app, these would be separate components or fully rendered here.
            */}
            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/10">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{confirmModal.title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                            <button onClick={confirmModal.onConfirm} className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/25">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View/Edit User Modals would go here (omitted for brevity but logic exists) */}
        </div>
    );
};

export default AdminDashboardScreen;
