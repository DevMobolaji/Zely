
import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutDashboard, Users, CreditCard, Settings, LogOut, Bell, Search,
    MoreHorizontal, ChevronDown, CheckCircle2, AlertCircle, X, Loader2,
    Trash2, Edit2, Shield, User, ArrowUpRight, ArrowDownLeft, Filter, Download,
    Gauge, Calendar, Eye, Wallet, Clock, Activity, ChevronUp, History, Info,
    Menu
} from 'lucide-react';

interface AdminDashboardProps {
    onLogout: () => void;
}

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
    type: 'payment' | 'refund' | 'transfer';
    flow: 'in' | 'out';
    status: 'success' | 'failed' | 'pending';
    date: string;
}

interface AdminActivity {
    id: string;
    adminName: string;
    action: string;
    target: string;
    time: string;
    type: 'delete' | 'edit' | 'security' | 'system';
}

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

const generateMockActivities = (): AdminActivity[] => [
    { id: 'a1', adminName: 'Super Admin', action: 'Deleted transaction', target: 'TX-9902', time: '2 mins ago', type: 'delete' },
    { id: 'a2', adminName: 'Alice Smith', action: 'Updated status of user', target: 'John Doe', time: '1 hour ago', type: 'edit' },
    { id: 'a3', adminName: 'System', action: 'Automated backup completed', target: 'Database', time: '3 hours ago', type: 'system' },
    { id: 'a4', adminName: 'Super Admin', action: 'Suspended user account', target: 'Bob Johnson', time: '5 hours ago', type: 'security' },
];

const CustomDropdown: React.FC<{
    value: string;
    options: { value: string; label: string; icon?: React.ElementType }[];
    onChange: (value: string) => void;
    label?: string;
}> = ({ value, options, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && setIsOpen(false);
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    const selected = options.find(o => o.value === value);
    return (
        <div className="relative" ref={dropdownRef}>
            {label && <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase ml-1">{label}</label>}
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between transition-all hover:border-primary font-semibold text-sm text-slate-900 dark:text-white">
                <span className="flex items-center gap-2">{selected?.icon && <selected.icon className="w-4 h-4 text-slate-400" />}{selected?.label}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {options.map(o => (
                        <button key={o.value} type="button" onClick={() => { onChange(o.value); setIsOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 ${value === o.value ? 'text-primary bg-primary/5' : 'text-slate-600 dark:text-slate-300'}`}>
                            {o.icon && <o.icon className="w-4 h-4" />}{o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const AdminDashboardScreen: React.FC<AdminDashboardProps> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'transactions' | 'settings'>('overview');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [users, setUsers] = useState<UserData[]>(generateMockUsers());
    const [transactions, setTransactions] = useState<AdminTransaction[]>(generateMockTransactions());
    const [activities] = useState<AdminActivity[]>(generateMockActivities());
    const [searchQuery, setSearchQuery] = useState('');
    const [activeChartIndex, setActiveChartIndex] = useState(2);

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

    const handleConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmModal({ isOpen: true, title, message, onConfirm });
    };

    const handleDeleteUser = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        handleConfirm(
            'Delete User Account?',
            'This will permanently remove the user and all associated transaction records. This action is irreversible.',
            () => {
                setUsers(prev => prev.filter(u => u.id !== id));
                setTransactions(prev => prev.filter(t => t.userId !== id));
                setConfirmModal(null);
            }
        );
    };

    const handleDeleteTransaction = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        handleConfirm(
            'Delete Transaction Record?',
            'Are you sure you want to delete this transaction record? This cannot be undone and will affect accounting logs.',
            () => {
                setTransactions(prev => prev.filter(t => t.id !== id));
                setConfirmModal(null);
            }
        );
    };

    const handleViewUserClick = (user: UserData) => {
        setViewedUser(user);
        setIsViewUserModalOpen(true);
    };

    const handleSortUsers = (key: keyof UserData) => {
        setUserSort(prev => ({ key, order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc' }));
    };

    const sortedUsers = [...users].sort((a, b) => {
        const valA = a[userSort.key];
        const valB = b[userSort.key];
        if (typeof valA === 'string' && typeof valB === 'string') {
            return userSort.order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
            return userSort.order === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
    });

    const sortedTransactions = [...transactions].sort((a, b) => {
        const valA = a[txSort.key];
        const valB = b[txSort.key];
        if (typeof valA === 'string' && typeof valB === 'string') {
            return txSort.order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
            return txSort.order === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
    });

    const StatusBadge = ({ status }: { status: string }) => {
        const styles = {
            active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        }[status] || 'bg-slate-100 text-slate-700';
        return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles}`}>{status}</span>;
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white font-sans overflow-hidden">
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

                    <div className="relative mb-8 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            placeholder="Quick find..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800 border-none rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none transition-all placeholder-slate-500"
                        />
                    </div>

                    <nav className="space-y-2 flex-1">
                        {[
                            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                            { id: 'users', icon: Users, label: 'Users' },
                            { id: 'transactions', icon: CreditCard, label: 'Transactions' },
                            { id: 'settings', icon: Settings, label: 'Settings' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id as any); setSidebarOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === item.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    <button onClick={onLogout} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors mt-auto">
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
                        <h1 className="text-xl font-bold capitalize">{activeTab}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="p-2 relative">
                            <Bell className="w-5 h-5 text-slate-500" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">A</div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 lg:p-10 no-scrollbar">
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

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 bg-slate-950 text-white rounded-[2rem] p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-8 relative z-10">
                                        <div className="flex items-center gap-3"><div className="p-2 bg-slate-900 rounded-xl border border-slate-800"><Gauge className="w-5 h-5 text-slate-300" /></div><h3 className="font-bold text-lg text-slate-200">System Performance</h3></div>
                                    </div>
                                    <div className="h-64 flex items-end gap-3 sm:gap-6 relative z-10 w-full mt-10 pl-2">
                                        {[{ day: 'M', p: 57 }, { day: 'T', p: 44 }, { day: 'W', p: 81 }, { day: 'T', p: 37 }, { day: 'F', p: 53 }, { day: 'S', p: 48 }, { day: 'S', p: 77 }].map((item, idx) => (
                                            <div key={idx} className="flex-1 h-full flex flex-col justify-end group cursor-pointer relative" onMouseEnter={() => setActiveChartIndex(idx)}>
                                                <div className={`w-full rounded-2xl transition-all duration-300 flex items-end justify-center pb-4 ${activeChartIndex === idx ? 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-900 scale-105 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'}`} style={{ height: `${item.p}%` }}>
                                                    <span className="font-bold text-[10px] sm:text-xs">+{item.p}%</span>
                                                </div>
                                                <p className={`text-center mt-3 text-xs font-bold transition-colors ${activeChartIndex === idx ? 'text-white' : 'text-slate-600'}`}>{item.day}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
                                    <div className="flex items-center gap-3 mb-6"><div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl"><History className="w-5 h-5" /></div><h3 className="text-lg font-bold">Audit Log</h3></div>
                                    <div className="space-y-4 flex-1">
                                        {activities.map(act => (
                                            <div key={act.id} className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${act.type === 'delete' ? 'bg-red-100 text-red-600 dark:bg-red-900/20' : act.type === 'edit' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}><Info className="w-4 h-4" /></div>
                                                <div className="overflow-hidden">
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{act.action}: {act.target}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">{act.adminName} • {act.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="mt-6 w-full py-2.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-500 hover:text-primary rounded-xl transition-colors border border-slate-100 dark:border-slate-700">View Full Log</button>
                                </div>
                            </div>
                        </div>
                    )}

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
                                        {sortedUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
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

                    {activeTab === 'transactions' && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center"><h2 className="text-lg font-bold">Transaction History</h2><button className="text-slate-500 hover:text-primary text-xs font-bold flex items-center gap-2"><Download className="w-4 h-4" /> Export All</button></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                                        <tr>
                                            {['id', 'userName', 'type', 'amount', 'status', 'date'].map((key) => (
                                                <th key={key} className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => setTxSort(prev => ({ key: key as any, order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc' }))}>
                                                    <div className="flex items-center gap-2">{key.toUpperCase()}{txSort.key === key && (txSort.order === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                                                </th>
                                            ))}
                                            <th className="px-6 py-4 text-right">ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {sortedTransactions.filter(t => t.userName.toLowerCase().includes(searchQuery.toLowerCase())).map(tx => (
                                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{tx.id}</td>
                                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{tx.userName}</td>
                                                <td className="px-6 py-4 capitalize font-medium text-slate-600 dark:text-slate-400">{tx.type}</td>
                                                <td className="px-6 py-4 font-black">${tx.amount.toFixed(2)}</td>
                                                <td className="px-6 py-4"><StatusBadge status={tx.status} /></td>
                                                <td className="px-6 py-4 text-slate-500 text-xs">{new Date(tx.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={(e) => handleDeleteTransaction(tx.id, e)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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

                    {activeTab === 'settings' && (
                        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center text-center pt-20 animate-in fade-in">
                            <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-6"><Settings className="w-12 h-12 text-slate-400" /></div>
                            <h2 className="text-2xl font-black mb-2">Admin Preferences</h2>
                            <p className="text-slate-500 mb-8">Configure system-wide limits, fees, and security settings.</p>
                            <div className="w-full space-y-4 text-left">
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center"><span className="font-bold">Maintenance Mode</span><div className="w-12 h-6 bg-slate-200 dark:bg-slate-800 rounded-full relative cursor-pointer"><div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all"></div></div></div>
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center"><span className="font-bold">New Registrations</span><div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer"><div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full transition-all"></div></div></div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Custom Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center">
                        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-8 h-8" /></div>
                        <h3 className="text-xl font-black mb-2">{confirmModal.title}</h3>
                        <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                            <button onClick={confirmModal.onConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {isEditUserModalOpen && currentUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-8 shadow-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Modify User</h3><button onClick={() => setIsEditUserModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
                        <form onSubmit={(e) => { e.preventDefault(); setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, ...editFormData } as UserData : u)); setIsEditUserModalOpen(false); }} className="space-y-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Full Name</label><input type="text" value={editFormData.name || ''} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-slate-900 dark:text-white" /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">Balance ($)</label><input type="number" value={editFormData.balance || 0} onChange={e => setEditFormData({ ...editFormData, balance: parseFloat(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-bold text-slate-900 dark:text-white" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <CustomDropdown label="Role" value={editFormData.role || 'user'} options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]} onChange={v => setEditFormData({ ...editFormData, role: v as UserRole })} />
                                <CustomDropdown label="Status" value={editFormData.status || 'active'} options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'pending', label: 'Pending' }]} onChange={v => setEditFormData({ ...editFormData, status: v as UserStatus })} />
                            </div>
                            <button type="submit" className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all mt-4 shadow-lg shadow-primary/20">Update User</button>
                        </form>
                    </div>
                </div>
            )}

            {/* View User Modal */}
            {isViewUserModalOpen && viewedUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center text-slate-900 dark:text-white">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">User Details</h3><button onClick={() => setIsViewUserModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${viewedUser.avatarSeed}`} className="w-24 h-24 rounded-full mx-auto mb-4 bg-slate-100" />
                        <h4 className="text-xl font-bold">{viewedUser.name}</h4>
                        <p className="text-slate-500 mb-6 font-medium">{viewedUser.email}</p>
                        <div className="space-y-4 text-left">
                            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800"><span className="text-slate-500 font-bold text-xs uppercase">Status</span><StatusBadge status={viewedUser.status} /></div>
                            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800"><span className="text-slate-500 font-bold text-xs uppercase">Role</span><span className="font-bold capitalize text-sm">{viewedUser.role}</span></div>
                            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800"><span className="text-slate-500 font-bold text-xs uppercase">Account Balance</span><span className="font-black text-sm">${viewedUser.balance.toLocaleString()}</span></div>
                        </div>
                        <button onClick={() => setIsViewUserModalOpen(false)} className="w-full mt-8 py-3 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl hover:bg-slate-200 transition-colors">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const AlertTriangle = (props: any) => <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;

export default AdminDashboardScreen;
