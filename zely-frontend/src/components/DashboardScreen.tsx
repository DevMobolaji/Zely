
import React, { useState, useEffect, useRef } from 'react';
import {
    Home, CreditCard, Activity, Settings, LogOut, Bell, Search,
    ArrowUpRight, ArrowDownLeft, Wallet, MoreHorizontal, Plus,
    ChevronDown, X, Send, Copy, CheckCircle2, AlertCircle, TrendingUp,
    Clock, XCircle, Calendar, Hash, Tag, Download, Edit2, RotateCw, FileText, User,
    Filter, MapPin, Info, Smartphone, Receipt, Zap, CalendarClock, ChevronRight, Eye, EyeOff,
    ChevronLeft, LayoutGrid, List, Loader2, AlertTriangle, QrCode, Check, Wifi, Droplets, Tv,
    Shield, CreditCard as CardIcon, ChevronUp, Key, Smartphone as Phone, Lock, RefreshCcw, Menu,
    Mail, ShieldCheck, UserCircle, BellRing, Globe, Languages, Camera, Laptop, Monitor, Tablet,
    CheckCircle, ShieldAlert,
    Sun,
    Moon,
} from 'lucide-react';

interface DashboardScreenProps {
    onLogout: () => void;
}

type TransactionStatus = 'success' | 'pending' | 'failed';
type TransactionType = 'incoming' | 'outgoing';

interface Transaction {
    id: string;
    title: string;
    category: string;
    amount: number;
    date: string;
    status: TransactionStatus;
    type: TransactionType;
    recipientName?: string;
    notes?: string;
    fee?: number;
    merchantDetails?: {
        name: string;
        address: string;
        mapPlaceholderColor?: string;
    };
}

interface Account {
    id: string;
    name: string;
    type: 'current' | 'savings' | 'virtual' | 'crypto';
    balance: number;
    currency: string;
    number: string;
    iban?: string;
    trend: string;
    trendUp: boolean;
    cardProvider?: 'VISA' | 'Mastercard';
    cardExpiry?: string;
    cardLast4?: string;
}

interface Notification {
    id: string;
    type: 'current' | 'debit' | 'security' | 'info' | 'credit';
    title: string;
    message: string;
    time: string;
    read: boolean;
}

interface Session {
    id: string;
    device: string;
    browser: string;
    location: string;
    lastActive: string;
    isCurrent: boolean;
    icon: React.ElementType;
}

const formatDate = (isoDate: string) => {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const initialSessions: Session[] = [
    { id: 's1', device: 'MacBook Pro 16"', browser: 'Chrome', location: 'San Francisco, US', lastActive: 'Active now', isCurrent: true, icon: Laptop },
    { id: 's2', device: 'iPhone 15 Pro', browser: 'Safari App', location: 'London, UK', lastActive: '2 hours ago', isCurrent: false, icon: Phone },
    { id: 's3', device: 'Windows Desktop', browser: 'Microsoft Edge', location: 'Tokyo, JP', lastActive: '3 days ago', isCurrent: false, icon: Monitor },
];

const generateMockData = (): Transaction[] => {
    const baseData: Transaction[] = [
        {
            id: '1',
            title: 'Netflix Subscription',
            category: 'Entertainment',
            amount: 15.99,
            date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            status: 'success',
            type: 'outgoing',
            recipientName: 'Netflix Inc.',
            notes: 'Monthly Standard Plan',
            fee: 0.00,
            merchantDetails: { name: 'Netflix Services', address: '100 Winchester Cir, Los Gatos, CA 95032', mapPlaceholderColor: 'bg-red-500' }
        },
        {
            id: '2',
            title: 'Design Project',
            category: 'Freelance',
            amount: 1250.00,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            status: 'success',
            type: 'incoming',
            recipientName: 'Acme Corp',
            notes: 'Web Redesign Q4 Payment',
            fee: 12.50
        },
        {
            id: '3',
            title: 'Transfer to Sarah',
            category: 'Transfer',
            amount: 50.00,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.5).toISOString(),
            status: 'failed',
            type: 'outgoing',
            recipientName: 'Sarah Smith',
            notes: 'Dinner Split',
            fee: 0.50
        },
        {
            id: '4',
            title: 'Grocery Store',
            category: 'Food',
            amount: 124.30,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
            status: 'success',
            type: 'outgoing',
            recipientName: 'Whole Foods Market',
            notes: 'Weekly groceries',
            fee: 0.00,
            merchantDetails: { name: 'Whole Foods', address: '500 1st St, San Francisco, CA 94105', mapPlaceholderColor: 'bg-green-600' }
        },
        {
            id: '5',
            title: 'Spotify',
            category: 'Entertainment',
            amount: 9.99,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
            status: 'pending',
            type: 'outgoing',
            recipientName: 'Spotify AB',
            notes: 'Premium Individual',
            fee: 0.00
        },
    ];

    let expanded: Transaction[] = [...baseData];
    for (let i = 0; i < 25; i++) {
        expanded.push({
            ...baseData[i % baseData.length],
            id: `${i + 6}`,
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * (i + 4)).toISOString(),
            title: `${baseData[i % baseData.length].title} #${i + 1}`
        });
    }
    return expanded;
};

const initialTransactions = generateMockData();

const notificationsData: Notification[] = [
    { id: 'n1', type: 'credit', title: 'Payment Received', message: 'You received $1,250.00 from Acme Corp.', time: '2 mins ago', read: false },
    { id: 'n2', type: 'debit', title: 'Subscription Paid', message: 'Netflix subscription of $15.99 was successful.', time: '2 hours ago', read: false },
    { id: 'n3', type: 'security', title: 'New Login', message: 'New login detected from Mac OS Chrome.', time: '5 hours ago', read: true },
    { id: 'n4', type: 'debit', title: 'Bill Payment', message: 'Electric Bill payment of $84.50 processed.', time: '1 day ago', read: true },
    { id: 'n5', type: 'info', title: 'Account Statement', message: 'Your monthly statement is ready to view.', time: '2 days ago', read: true },
];

const accountsData: Account[] = [
    {
        id: 'acc_1',
        name: 'Main Checking',
        type: 'current',
        balance: 12450.00,
        currency: '$',
        number: '8900 1234 5678 4298',
        iban: 'US89 3704 0044 0532 9900 4298',
        trend: '+2.4%',
        trendUp: true,
        cardProvider: 'VISA',
        cardExpiry: '12/25',
        cardLast4: '4298'
    },
    {
        id: 'acc_2',
        name: 'High-Yield Savings',
        type: 'savings',
        balance: 45200.50,
        currency: '$',
        number: '8900 9876 5432 9921',
        iban: 'US89 3704 0044 0532 1100 9921',
        trend: '+1.1%',
        trendUp: true,
        cardProvider: 'Mastercard',
        cardExpiry: '09/26',
        cardLast4: '8821'
    },
    {
        id: 'acc_3',
        name: 'Virtual Card',
        type: 'virtual',
        balance: 250.00,
        currency: '$',
        number: '4400 1122 3344 1122',
        trend: '-5.2%',
        trendUp: false,
        cardProvider: 'VISA',
        cardExpiry: '01/25',
        cardLast4: '1122'
    },
    {
        id: 'acc_4',
        name: 'Crypto Wallet',
        type: 'crypto',
        balance: 3.45,
        currency: 'ETH',
        number: '0x71C...9A21',
        trend: '+12.5%',
        trendUp: true,
    }
];

const PREDEFINED_CATEGORIES = [
    'Entertainment', 'Freelance', 'Transfer', 'Food', 'Utilities',
    'Groceries', 'Shopping', 'Health', 'Travel', 'Education', 'Other'
];

const performanceData = [
    { day: 'Mon', value: 57, sent: 540, received: 8500, label: 'Monday' },
    { day: 'Tue', value: 44, sent: 120, received: 7200, label: 'Tuesday' },
    { day: 'Wed', value: 81, sent: 2987, received: 11300, label: 'Wednesday' },
    { day: 'Thu', value: 37, sent: 800, received: 5900, label: 'Thursday' },
    { day: 'Fri', value: 53, sent: 450, received: 9100, label: 'Friday' },
    { day: 'Sat', value: 48, sent: 1200, received: 7800, label: 'Saturday' },
    { day: 'Sun', value: 77, sent: 600, received: 10500, label: 'Sunday' },
];

const billProviders = [
    { id: 'b1', name: 'Electric Corp', icon: Zap, color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20' },
    { id: 'b2', name: 'Water Works', icon: Droplets, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/20' },
    { id: 'b3', name: 'SuperNet', icon: Wifi, color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/20' },
    { id: 'b4', name: 'StreamTV', icon: Tv, color: 'text-red-500 bg-red-100 dark:bg-red-900/20' },
];

const CustomDropdown: React.FC<{
    value: string;
    options: { value: string; label: string; icon?: React.ElementType }[];
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    className?: string;
}> = ({ value, options, onChange, label, placeholder, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {label && <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1.5">{label}</label>}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 flex items-center justify-between transition-all hover:border-primary focus:ring-2 focus:ring-primary outline-none text-sm font-semibold text-slate-900 dark:text-white"
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedOption?.icon && <selectedOption.icon className="w-4 h-4 text-slate-400" />}
                    <span>{selectedOption?.label || placeholder}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${value === opt.value ? 'text-primary bg-primary/5' : 'text-slate-600 dark:text-slate-300'}`}
                            >
                                {opt.icon && <opt.icon className="w-4 h-4" />}
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const Toast: React.FC<{ type: 'success' | 'error'; message: string; onClose: () => void }> = ({ type, message, onClose }) => (
    <div className={`fixed top-20 sm:top-6 left-1/2 transform -translate-x-1/2 z-[2147483647] flex items-start justify-between gap-4 px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 fade-in w-[calc(100%-2rem)] sm:w-max max-w-[500px] sm:min-w-[320px] ${type === 'success'
        ? 'bg-white dark:bg-slate-800 border-l-4 border-green-500'
        : 'bg-white dark:bg-slate-800 border-l-4 border-red-500'
        }`}>
        <div className="flex items-start gap-3 overflow-hidden">
            {type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            ) : (
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 break-words leading-relaxed">{message}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0 ml-2">
            <X className="w-4 h-4 text-slate-400" />
        </button>
    </div>
);

const DashboardScreen: React.FC<DashboardScreenProps> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
    const [showSendModal, setShowSendModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showPayBillsModal, setShowPayBillsModal] = useState(false);

    const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
    const currentAccount = accountsData[currentAccountIndex];
    const [showBalance, setShowBalance] = useState(true);

    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        type: 'all',
        status: 'all',
        startDate: '',
        endDate: '',
        minAmount: '',
        maxAmount: ''
    });

    const [visibleCount, setVisibleCount] = useState(10);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [showRepeatConfirm, setShowRepeatConfirm] = useState(false);
    const [isEditingCategory, setIsEditingCategory] = useState(false);
    const [repeatStep, setRepeatStep] = useState<'confirm' | 'processing' | 'success'>('confirm');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    const [isCopied, setIsCopied] = useState(false);
    const [isAccountCopied, setIsAccountCopied] = useState(false);

    const [selectedBillProvider, setSelectedBillProvider] = useState<string | null>(null);
    const [billAmount, setBillAmount] = useState('');
    const [billAccountNum, setBillAccountNum] = useState('');
    const [billStep, setBillStep] = useState<'select' | 'form' | 'processing' | 'success'>('select');

    const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);

    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [is2FALoading, setIs2FALoading] = useState(false);
    const [show2FASetup, setShow2FASetup] = useState(false);
    const [test2FACode, setTest2FACode] = useState('');
    const [isTestingCode, setIsTestingCode] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [isKeyCopied, setIsKeyCopied] = useState(false);

    // Backup Codes State
    const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
    const [backupCodes] = useState([
        '4298-1234', '8821-5678', '1122-9012', '3344-7788',
        '5566-1133', '7788-9900', '1029-3847', '5647-3829'
    ]);

    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isChangingEmail, setIsChangingEmail] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [isFormSubmitting, setIsFormSubmitting] = useState(false);
    const [dashboardToast, setDashboardToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);

    const [emailNotifs, setEmailNotifs] = useState(true);
    const [pushNotifs, setPushNotifs] = useState(true);
    const [marketingNotifs, setMarketingNotifs] = useState(false);

    const [sessions, setSessions] = useState<Session[]>(initialSessions);

    const [language, setLanguage] = useState('en-US');
    const [region, setRegion] = useState('us');
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const isDarkMode = document.documentElement.classList.contains('dark') ||
            window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDark(isDarkMode);
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        const newDark = !isDark;
        setIsDark(newDark);
        if (newDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    useEffect(() => {
        setVisibleCount(10);
    }, [searchQuery, filters, activeTab]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showToast = (type: 'success' | 'error', message: string) => {
        setDashboardToast({ type, message });
        setTimeout(() => setDashboardToast(null), 5000);
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            showToast('error', "New passwords don't match.");
            return;
        }
        setIsFormSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsFormSubmitting(false);
        setIsChangingPassword(false);
        showToast('success', "Your security password has been changed successfully.");
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
    };

    const handleEmailUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail) return;
        setIsFormSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsFormSubmitting(false);
        setIsChangingEmail(false);
        showToast('success', "Email verification link has been sent to " + newEmail);
        setNewEmail('');
    };

    const handleLogoutSession = (sessionId: string) => {
        setConfirmModal({
            title: 'End Session?',
            message: 'Are you sure you want to end this login session? You will be signed out on that device.',
            onConfirm: () => {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                setConfirmModal(null);
                showToast('success', "Session ended successfully.");
            }
        });
    };

    const handleLogoutAllOther = () => {
        setConfirmModal({
            title: 'Logout Other Devices?',
            message: 'Are you sure you want to log out from all other devices? This will end all active sessions except your current one.',
            onConfirm: () => {
                setSessions(prev => prev.filter(s => s.isCurrent));
                setConfirmModal(null);
                showToast('success', "All other sessions have been logged out.");
            }
        });
    };

    const toggle2FA = async () => {
        setIs2FALoading(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        setIs2FALoading(false);
        if (is2FAEnabled) {
            setConfirmModal({
                title: 'Disable 2FA?',
                message: 'Are you sure you want to disable Two-Factor Authentication? Your account will be significantly less protected.',
                onConfirm: () => {
                    setIs2FAEnabled(false);
                    setShow2FASetup(false);
                    setConfirmModal(null);
                    showToast('success', "Two-Factor Authentication has been disabled.");
                }
            });
        } else {
            setShow2FASetup(true);
        }
    };

    const handleCopyKey = () => {
        navigator.clipboard.writeText("JBSW Y3DP EBLX A3IT");
        setIsKeyCopied(true);
        setTimeout(() => setIsKeyCopied(false), 2000);
    };

    const handleDownloadBackupCodes = () => {
        const content = "ZELY FINTECH - 2FA BACKUP CODES\n\nKeep these codes in a safe place. Each code can only be used once.\n\n" + backupCodes.join("\n") + "\n\nGenerated on: " + new Date().toLocaleString();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = "zely_backup_codes.txt";
        link.click();
        URL.revokeObjectURL(url);
        showToast('success', "Backup codes downloaded successfully.");
    };

    const handleVerifyTestCode = async () => {
        if (!test2FACode) return;
        setIsTestingCode(true);
        setTestResult(null);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsTestingCode(false);

        if (test2FACode === '123456') {
            setTestResult('success');
            setTimeout(() => {
                setIs2FAEnabled(true);
                setShow2FASetup(false);
                setTest2FACode('');
                setTestResult(null);
                showToast('success', "Two-Factor Authentication is now active!");
            }, 1000);
        } else {
            setTestResult('error');
        }
    };

    const filteredTransactions = transactions.filter(tx => {
        const matchesSearch = tx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tx.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filters.type === 'all' || tx.type === filters.type;
        const matchesStatus = filters.status === 'all' || tx.status === filters.status;
        let matchesDate = true;
        const txTime = new Date(tx.date).getTime();
        if (filters.startDate) {
            matchesDate = matchesDate && txTime >= new Date(filters.startDate).getTime();
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && txTime <= end.getTime();
        }
        let matchesAmount = true;
        if (filters.minAmount) matchesAmount = matchesAmount && tx.amount >= Number(filters.minAmount);
        if (filters.maxAmount) matchesAmount = matchesAmount && tx.amount <= Number(filters.maxAmount);

        return matchesSearch && matchesType && matchesStatus && matchesDate && matchesAmount;
    });

    const displayedTransactions = activeTab === 'home'
        ? filteredTransactions.slice(0, 5)
        : filteredTransactions.slice(0, visibleCount);

    const hasMore = filteredTransactions.length > displayedTransactions.length;

    const [sendAmount, setSendAmount] = useState('');
    const [sendRecipient, setSendRecipient] = useState('');
    const [sendStep, setSendStep] = useState<'input' | 'confirm' | 'processing' | 'success'>('input');
    const [senderAccountIndex, setSenderAccountIndex] = useState(0);
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const [sendErrors, setSendErrors] = useState<{ recipient?: string, amount?: string }>({});

    useEffect(() => {
        if (showSendModal) {
            setSenderAccountIndex(currentAccountIndex);
        }
    }, [showSendModal, currentAccountIndex]);

    const handleSendInputSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errors: { recipient?: string, amount?: string } = {};
        if (!sendRecipient.trim()) {
            errors.recipient = "Recipient is required";
        }
        if (!sendAmount || Number(sendAmount) <= 0) {
            errors.amount = "Please enter a valid amount";
        }
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
            setSendStep('success');
            const senderAccount = accountsData[senderAccountIndex];
            const newTx: Transaction = {
                id: Date.now().toString(),
                title: `Transfer to ${sendRecipient}`,
                category: 'Transfer',
                amount: Number(sendAmount),
                date: new Date().toISOString(),
                status: 'success',
                type: 'outgoing',
                recipientName: sendRecipient,
                notes: `Transfer from ${senderAccount.name}`,
                fee: 0.00
            };
            setTransactions(prev => [newTx, ...prev]);
        }, 2000);
    };

    const resetSendModal = () => {
        setShowSendModal(false);
        setSendStep('input');
        setSendAmount('');
        setSendRecipient('');
        setSenderAccountIndex(currentAccountIndex);
        setShowAccountDropdown(false);
        setSendErrors({});
    };

    const handleExportCSV = () => {
        const headers = ['ID', 'Title', 'Category', 'Amount', 'Date', 'Status', 'Type', 'Recipient', 'Notes', 'Fee', 'Merchant'];
        const csvContent = [
            headers.join(','),
            ...transactions.map(tx => [
                tx.id,
                `"${tx.title}"`,
                `"${tx.category}"`,
                tx.amount,
                `"${tx.date}"`,
                tx.status,
                tx.type,
                `"${tx.recipientName || ''}"`,
                `"${tx.notes || ''}"`,
                tx.fee || 0,
                `"${tx.merchantDetails?.name || ''}"`
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleUpdateCategory = (newCategory: string) => {
        if (!selectedTransaction) return;
        const updatedTx = { ...selectedTransaction, category: newCategory };
        setSelectedTransaction(updatedTx);
        setTransactions(prev => prev.map(tx => tx.id === selectedTransaction.id ? updatedTx : tx));
        setIsEditingCategory(false);
        setShowCategoryDropdown(false);
    };

    const handleRepeatTransaction = () => {
        setRepeatStep('confirm');
        setShowRepeatConfirm(true);
    };

    const executeRepeatTransaction = () => {
        if (!selectedTransaction) return;
        setRepeatStep('processing');
        setTimeout(() => {
            const baseTitle = selectedTransaction.title.replace(/ \(Repeated\)/g, '');
            const newTx: Transaction = {
                ...selectedTransaction,
                id: Date.now().toString(),
                date: new Date().toISOString(),
                status: 'success',
                title: baseTitle,
            };
            setTransactions(prev => [newTx, ...prev]);
            setRepeatStep('success');
        }, 2000);
    };

    const handleCloseRepeatModal = () => {
        setShowRepeatConfirm(false);
        setRepeatStep('confirm');
        setSelectedTransaction(null);
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(`https://framergen.app/pay/john_doe`);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleCopyAccount = () => {
        navigator.clipboard.writeText(currentAccount.number);
        setIsAccountCopied(true);
        setTimeout(() => setIsAccountCopied(false), 2000);
    };

    const resetReceiveModal = () => {
        setShowReceiveModal(false);
        setIsCopied(false);
        setIsAccountCopied(false);
    };

    const handleBillProviderSelect = (id: string) => {
        setSelectedBillProvider(id);
        setBillStep('form');
    };

    const handlePayBill = (e: React.FormEvent) => {
        e.preventDefault();
        if (!billAmount || !billAccountNum) return;
        setBillStep('processing');
        setTimeout(() => {
            const provider = billProviders.find(p => p.id === selectedBillProvider);
            const newTx: Transaction = {
                id: Date.now().toString(),
                title: `Bill Payment: ${provider?.name}`,
                category: 'Utilities',
                amount: Number(billAmount),
                date: new Date().toISOString(),
                status: 'success',
                type: 'outgoing',
                recipientName: provider?.name,
                notes: `Account: ${billAccountNum}`,
                fee: 0.50
            };
            setTransactions(prev => [newTx, ...prev]);
            setBillStep('success');
        }, 2000);
    };

    const resetBillModal = () => {
        setShowPayBillsModal(false);
        setBillStep('select');
        setSelectedBillProvider(null);
        setBillAmount('');
        setBillAccountNum('');
    };

    const FilterPanel = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4 duration-300 mb-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold flex items-center gap-2 text-lg"><Filter className="w-5 h-5 text-primary" /> Filter Transactions</h3>
                <button
                    onClick={() => {
                        setFilters({ type: 'all', status: 'all', startDate: '', endDate: '', minAmount: '', maxAmount: '' });
                        setSearchQuery('');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-primary transition-colors bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg"
                >
                    Reset All
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <CustomDropdown
                    label="Type"
                    value={filters.type}
                    options={[
                        { value: 'all', label: 'All Types' },
                        { value: 'incoming', label: 'Incoming', icon: ArrowDownLeft },
                        { value: 'outgoing', label: 'Outgoing', icon: ArrowUpRight },
                    ]}
                    onChange={(val) => setFilters(prev => ({ ...prev, type: val }))}
                />
                <CustomDropdown
                    label="Status"
                    value={filters.status}
                    options={[
                        { value: 'all', label: 'All Statuses' },
                        { value: 'success', label: 'Success', icon: CheckCircle2 },
                        { value: 'pending', label: 'Pending', icon: Clock },
                        { value: 'failed', label: 'Failed', icon: XCircle },
                    ]}
                    onChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
                />
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Date Range</label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-2 py-3 text-xs font-semibold border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center"
                        />
                        <span className="text-slate-300 font-bold">-</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-2 py-3 text-xs font-semibold border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Amount ($)</label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="number"
                            placeholder="Min"
                            value={filters.minAmount}
                            onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-3 text-sm font-semibold border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                        <span className="text-slate-300 font-bold">-</span>
                        <input
                            type="number"
                            placeholder="Max"
                            value={filters.maxAmount}
                            onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-3 text-sm font-semibold border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    const handleTabClick = (tab: string) => {
        setActiveTab(tab);
        setIsSidebarOpen(false);
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white overflow-hidden font-sans transition-colors duration-300 relative">

            {dashboardToast && (
                <Toast
                    type={dashboardToast.type}
                    message={dashboardToast.message}
                    onClose={() => setDashboardToast(null)}
                />
            )}

            {confirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
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

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={`fixed lg:static inset-y-0 left-0 flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-full p-6 justify-between shrink-0 z-50 transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div>
                    <div className="flex items-center justify-between mb-10 px-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary p-2 rounded-xl">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold tracking-tight">Zely</span>
                        </div>
                        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                    <nav className="space-y-2">
                        {[
                            { id: 'home', icon: Home, label: 'Overview' },
                            { id: 'activity', icon: List, label: 'All Activity' },
                            { id: 'wallet', icon: Wallet, label: 'My Wallet' },
                            { id: 'cards', icon: CreditCard, label: 'Cards' },
                            { id: 'settings', icon: Settings, label: 'Settings' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleTabClick(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === item.id
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-200 dark:shadow-none'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Monthly Budget</p>
                                <p className="text-sm font-bold">75% Used</p>
                            </div>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full w-3/4"></div>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Log Out
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-full overflow-hidden relative animate-enter-fade">
                <header className="h-20 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 z-10 gap-4 shrink-0 animate-enter-slide-down">
                    <div className="flex items-center gap-4 shrink-0">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="hidden sm:flex lg:hidden bg-primary p-2 rounded-lg">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div className="shrink-0">
                            <h1 className="text-base sm:text-xl font-bold leading-tight">
                                {activeTab === 'home' ? 'Dashboard' :
                                    activeTab === 'activity' ? 'Activity' :
                                        activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                            </h1>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Welcome back, John Doe</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-1 justify-end">
                        <div className="relative group w-full max-w-[200px] sm:max-w-xs transition-all duration-300 hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-12 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                            />
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${showFilters ? 'bg-primary text-white' : 'text-slate-400 hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                <Filter className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="sm:hidden p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                            <Filter className="w-5 h-5" />
                        </button>
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            aria-label="Toggle Dark Mode"
                        >
                            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`relative p-2 rounded-full transition-colors shrink-0 ${showNotifications ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                            </button>
                            {showNotifications && (
                                <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                                    <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
                                        <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                                        <span className="text-xs font-bold text-primary cursor-pointer hover:underline">Mark all as read</span>
                                    </div>
                                    <div className="max-h-[60vh] overflow-y-auto">
                                        {notificationsData.map(note => (
                                            <div key={note.id} className="p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${note.type === 'credit' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                                    note.type === 'debit' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        note.type === 'security' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}>
                                                    {note.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> :
                                                        note.type === 'debit' ? <ArrowUpRight className="w-5 h-5" /> :
                                                            note.type === 'security' ? <Shield className="w-5 h-5" /> :
                                                                <Info className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{note.title}</h4>
                                                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-2">{note.time}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{note.message}</p>
                                                </div>
                                                {!note.read && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0"></div>}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 text-center">
                                        <button className="text-xs font-bold text-slate-500 hover:text-primary transition-colors">View All Notifications</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-400 p-0.5 cursor-pointer shrink-0">
                            <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="Avatar" className="w-full h-full" />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 no-scrollbar">
                    {showFilters && <FilterPanel />}

                    {activeTab === 'home' && (
                        <div className="w-full max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-enter-slide-up delay-100 opacity-0 [animation-fill-mode:forwards]">
                            <div className="lg:col-span-2 space-y-8">
                                <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 dark:bg-slate-800 text-white p-6 sm:p-8 shadow-2xl transition-all duration-300">
                                    <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-colors duration-500 ${currentAccount.type === 'crypto' ? 'bg-indigo-500/30' : currentAccount.type === 'savings' ? 'bg-green-500/30' : 'bg-primary/30'}`}></div>
                                    <div className={`absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 transition-colors duration-500 ${currentAccount.type === 'crypto' ? 'bg-purple-500/20' : currentAccount.type === 'savings' ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}></div>
                                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setCurrentAccountIndex((prev) => (prev + 1) % accountsData.length)}
                                                        className="flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all"
                                                    >
                                                        {currentAccount.name}
                                                        <ChevronRight className="w-4 h-4 opacity-50" />
                                                    </button>
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-white/20 ${currentAccount.type === 'savings' ? 'text-green-300 bg-green-500/10' :
                                                    currentAccount.type === 'crypto' ? 'text-indigo-300 bg-indigo-500/10' :
                                                        'text-blue-300 bg-blue-500/10'
                                                    }`}>
                                                    {currentAccount.type}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 font-medium mb-1 flex items-center gap-2">
                                                Total Balance
                                                <button onClick={() => setShowBalance(!showBalance)} className="opacity-50 hover:opacity-100 transition-opacity p-1">
                                                    {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </button>
                                            </p>
                                            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-2 break-words">
                                                {currentAccount.currency === 'ETH' ? 'Ξ' : '$'}
                                                {showBalance
                                                    ? currentAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })
                                                    : '••••••'
                                                }
                                            </h2>
                                            <div className="mb-4">
                                                <p className="font-mono text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-2">
                                                    {currentAccount.iban ? (
                                                        <>
                                                            <span className="opacity-50 select-none">IBAN:</span>
                                                            <span className="tracking-wider break-all">{showBalance ? currentAccount.iban : 'US89 •••• •••• •••• •••• ••••'}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="opacity-50 select-none">Account:</span>
                                                            <span className="tracking-wider">{showBalance ? currentAccount.number : '•••• •••• •••• 4298'}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full w-fit text-sm font-bold ${currentAccount.trendUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {currentAccount.trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                                {currentAccount.trend} this month
                                            </div>
                                        </div>
                                        {currentAccount.type !== 'crypto' && (
                                            <div className="w-full md:w-80 h-48 rounded-2xl glassmorphism border border-white/10 p-6 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 shrink-0 shadow-lg">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
                                                <div className="relative z-10 flex justify-between items-start w-full">
                                                    <div className="w-12 h-9 rounded bg-yellow-300 overflow-hidden relative border border-yellow-500 shadow-sm flex items-center justify-center">
                                                        <div className="absolute inset-0 border border-yellow-600/30 rounded m-[2px]"></div>
                                                        <div className="w-full h-[1px] bg-yellow-600/30 absolute top-1/2 -translate-y-1/2"></div>
                                                        <div className="h-full w-[1px] bg-yellow-600/30 absolute left-1/2 -translate-x-1/2"></div>
                                                        <div className="absolute top-2 left-2 right-2 bottom-2 border border-yellow-600/20 rounded-sm"></div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        {currentAccount.cardProvider === 'Mastercard' ? (
                                                            <div className="flex -space-x-4 relative">
                                                                <div className="w-8 h-8 rounded-full bg-red-600 mix-blend-screen"></div>
                                                                <div className="w-8 h-8 rounded-full bg-yellow-500 mix-blend-screen"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="font-serif italic font-black text-2xl tracking-tighter text-white">VISA</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="relative z-10 mt-auto">
                                                    <p className="font-mono text-xl tracking-widest text-white/90 mb-2 drop-shadow-sm">**** **** **** {showBalance ? currentAccount.cardLast4 : '••••'}</p>
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-[9px] text-white/60 uppercase tracking-widest mb-0.5">Card Holder</p>
                                                            <p className="text-sm font-semibold tracking-wider text-white">JOHN DOE</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] text-white/60 uppercase tracking-widest mb-0.5">Expires</p>
                                                            <p className="text-sm font-semibold tracking-wider text-white">{currentAccount.cardExpiry}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {currentAccount.type === 'crypto' && (
                                            <div className="w-full md:w-80 h-48 rounded-2xl bg-indigo-600/20 border border-white/10 p-6 flex flex-col justify-center items-center relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 shrink-0">
                                                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                                                    <Wallet className="w-8 h-8 text-white" />
                                                </div>
                                                <p className="text-white/80 font-bold tracking-wide">Ethereum Wallet</p>
                                                <p className="text-xs text-white/50 font-mono mt-1 break-all text-center px-4">{showBalance ? currentAccount.number : '0x71C...••••'}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative z-10 grid grid-cols-4 gap-2 sm:gap-4 mt-8 pt-8 border-t border-white/10">
                                        <button onClick={() => setShowSendModal(true)} className="flex flex-col items-center gap-2 group transition-colors">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary hover:bg-primary-light flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1 shadow-lg shadow-primary/30">
                                                <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <span className="text-[10px] sm:text-xs font-semibold text-slate-300 group-hover:text-white">Send</span>
                                        </button>
                                        <button onClick={() => setShowReceiveModal(true)} className="flex flex-col items-center gap-2 group transition-colors">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1">
                                                <ArrowDownLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <span className="text-[10px] sm:text-xs font-semibold text-slate-300 group-hover:text-white">Receive</span>
                                        </button>
                                        <button onClick={() => setShowPayBillsModal(true)} className="flex flex-col items-center gap-2 group transition-colors">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1">
                                                <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <span className="text-[10px] sm:text-xs font-semibold text-slate-300 group-hover:text-white">Bills</span>
                                        </button>
                                        <button className="flex flex-col items-center gap-2 group transition-colors">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1">
                                                <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <span className="text-[10px] sm:text-xs font-semibold text-slate-300 group-hover:text-white">Recharge</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                    <Activity className="w-4 h-4 text-slate-900 dark:text-white" />
                                                </div>
                                                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">Performance Tracker</h3>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Performance</h2>
                                                <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">+12% vs last week</span>
                                            </div>
                                        </div>
                                        <button className="flex items-center gap-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Last week
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="relative h-64 w-full mt-4" onMouseLeave={() => setHoveredChartIndex(null)}>
                                        <div className="flex justify-between items-end h-full gap-2 sm:gap-4">
                                            {performanceData.map((item, index) => (
                                                <div key={item.day} className="relative flex-1 h-full flex flex-col justify-end group cursor-pointer" onMouseEnter={() => setHoveredChartIndex(index)}>
                                                    {hoveredChartIndex === index && (
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-40 bg-slate-900 text-white p-3 rounded-xl shadow-xl z-30 border border-slate-700 animate-in fade-in zoom-in-95 duration-200 hidden sm:block">
                                                            <p className="text-xs font-bold mb-2 text-slate-400">{item.label}</p>
                                                            <div className="space-y-1.5">
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                                                                        <span className="text-slate-500">Amount Sent</span>
                                                                    </div>
                                                                    <span className="font-bold">${item.sent.toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                                                                        <span className="text-slate-500">Amount Received</span>
                                                                    </div>
                                                                    <span className="font-bold">${(item.received / 1000).toFixed(1)}k</span>
                                                                </div>
                                                            </div>
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                                        </div>
                                                    )}
                                                    <div className="relative w-10 sm:w-16 mx-auto h-[85%] bg-slate-100 dark:bg-slate-800/50 rounded-2xl overflow-hidden transition-colors duration-300">
                                                        <div className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ease-out rounded-t-sm rounded-b-2xl flex items-end justify-center pb-2 ${hoveredChartIndex === index ? 'bg-slate-900 dark:bg-slate-200' : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-600'}`} style={{ height: `${item.value}%` }}>
                                                            <span className={`text-[10px] sm:text-xs font-bold ${hoveredChartIndex === index ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>+{item.value}%</span>
                                                        </div>
                                                    </div>
                                                    <p className={`text-center mt-3 text-xs font-bold transition-colors ${hoveredChartIndex === index ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{item.day}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-bold">Recent Transactions</h3>
                                        <div className="flex gap-2">
                                            <button onClick={handleExportCSV} className="text-sm font-bold flex items-center gap-1 text-slate-500 hover:text-primary transition-colors"><Download className="w-4 h-4" /> CSV</button>
                                            <button onClick={() => setActiveTab('activity')} className="text-sm font-bold text-primary hover:text-primary-light p-2 -mr-2">View All</button>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                                        {displayedTransactions.length > 0 ? displayedTransactions.map((tx, index) => (
                                            <div key={tx.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group active:bg-slate-100 dark:active:bg-slate-800 ${index !== displayedTransactions.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`} onClick={() => { setSelectedTransaction(tx); setIsEditingCategory(false); setRepeatStep('confirm'); setShowRepeatConfirm(false); setShowCategoryDropdown(false); }}>
                                                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${tx.status === 'failed' ? 'bg-red-100 dark:bg-red-900/20 text-red-500' : tx.type === 'incoming' ? 'bg-green-100 dark:bg-green-900/20 text-green-500' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-300 text-slate-500'}`}>
                                                        {tx.status === 'failed' ? <AlertCircle className="w-5 h-5" /> : tx.type === 'incoming' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate group-hover:text-primary transition-colors">{tx.title}</h4>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{formatDate(tx.date)} • {tx.category}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 pl-2 shrink-0">
                                                    <div className="text-right">
                                                        <p className={`font-bold text-sm sm:text-base ${tx.type === 'incoming' ? 'text-green-500' : 'text-slate-900 dark:text-white'}`}>{tx.type === 'incoming' ? '+' : '-'}${tx.amount.toFixed(2)}</p>
                                                        <div className="flex justify-end mt-1">
                                                            {tx.status === 'success' && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />}
                                                            {tx.status === 'failed' && <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />}
                                                            {tx.status === 'pending' && <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : <div className="p-8 text-center text-slate-500 dark:text-slate-400">No transactions found.</div>}
                                        <button onClick={() => setActiveTab('activity')} className="w-full py-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold text-slate-500 hover:text-primary transition-colors flex items-center justify-center gap-2">View All Activity <ChevronRight className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold mb-4">Quick Transfer</h3>
                                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                                        {['Sarah', 'Mike', 'Anna', 'Dad', 'Mom'].map((name, i) => (
                                            <div key={i} className="flex flex-col items-center gap-2 min-w-[60px] cursor-pointer group">
                                                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-2 border-transparent group-hover:border-primary transition-all">
                                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} alt={name} />
                                                </div>
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{name}</span>
                                            </div>
                                        ))}
                                        <div className="flex flex-col items-center gap-2 min-w-[60px] cursor-pointer group">
                                            <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:border-primary transition-all">
                                                <Plus className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Add New</span>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Amount</label>
                                        <div className="relative mt-2">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                                            <input type="number" placeholder="0.00" className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-4 pl-8 pr-4 font-bold outline-none focus:ring-2 focus:ring-primary transition-all text-base" />
                                            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary p-2 rounded-lg text-white hover:bg-primary-light transition-colors"><Send className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold flex items-center gap-2"><CalendarClock className="w-5 h-5 text-slate-400" /> Scheduled</h3>
                                        <button className="text-xs font-bold text-primary p-2 -mr-2">View All</button>
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'sp1', title: 'Netflix', amount: 15.99, due: 'Tomorrow', icon: <Activity className="w-4 h-4" /> },
                                            { id: 'sp2', title: 'Electric Bill', amount: 84.50, due: 'Oct 30', icon: <Zap className="w-4 h-4" /> },
                                            { id: 'sp3', title: 'Mobile Data', amount: 45.00, due: 'Nov 01', icon: <Smartphone className="w-4 h-4" /> },
                                        ].map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">{item.icon}</div>
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</p>
                                                        <p className="text-xs text-slate-500 font-medium">Due {item.due}</p>
                                                    </div>
                                                </div>
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">-${item.amount}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                                    <div className="flex items-center gap-3 mb-6 relative z-10"><div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><Activity className="w-5 h-5" /></div><h3 className="font-bold">Weekly Spend</h3></div>
                                    <div className="mb-2 flex justify-between items-end relative z-10"><span className="text-3xl font-black">$432.50</span><span className="text-sm font-medium text-purple-200">of $1,000</span></div>
                                    <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden relative z-10"><div className="bg-white h-full w-[43%] rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="w-full mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setActiveTab('home')} className="lg:hidden p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ChevronLeft className="w-6 h-6" /></button>
                                    <h2 className="text-2xl font-black">All Transactions</h2>
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1 sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="text" placeholder="Search activity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:ring-2 focus:ring-primary outline-none" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                                {displayedTransactions.length > 0 ? displayedTransactions.map((tx, index) => (
                                    <div key={tx.id} className={`p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group active:bg-slate-100 dark:active:bg-slate-800 ${index !== displayedTransactions.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`} onClick={() => { setSelectedTransaction(tx); setIsEditingCategory(false); setRepeatStep('confirm'); setShowRepeatConfirm(false); setShowCategoryDropdown(false); }}>
                                        <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${tx.status === 'failed' ? 'bg-red-100 dark:bg-red-900/20 text-red-500' : tx.type === 'incoming' ? 'bg-green-100 dark:bg-green-900/20 text-green-500' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-300 text-slate-500'}`}>
                                                {tx.status === 'failed' ? <AlertCircle className="w-5 h-5" /> : tx.type === 'incoming' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-base truncate group-hover:text-primary transition-colors">{tx.title}</h4>
                                                    <p className={`font-bold text-base whitespace-nowrap ml-2 ${tx.type === 'incoming' ? 'text-green-500' : 'text-slate-900 dark:text-white'}`}>{tx.type === 'incoming' ? '+' : '-'}${tx.amount.toFixed(2)}</p>
                                                </div>
                                                <div className="flex justify-between items-center"><p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate flex items-center gap-2">{formatDate(tx.date)} • <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">{tx.category}</span></p><div className="flex items-center gap-1">{tx.status === 'success' && <span className="text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Success</span>}{tx.status === 'failed' && <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Failed</span>}{tx.status === 'pending' && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">Pending</span>}</div></div>
                                            </div>
                                        </div>
                                    </div>
                                )) : <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 dark:text-slate-400"><div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4"><Search className="w-8 h-8 opacity-50" /></div><h3 className="text-lg font-bold mb-2">No Transactions Found</h3><p className="max-w-xs mx-auto text-sm">Try adjusting your filters or search query to find what you're looking for.</p><button onClick={() => { setFilters({ type: 'all', status: 'all', startDate: '', endDate: '', minAmount: '', maxAmount: '' }); setSearchQuery(''); }} className="mt-6 font-bold text-primary hover:underline">Clear Filters</button></div>}
                                {hasMore && <div className="p-4 border-t border-slate-100 dark:border-slate-800"><button onClick={() => setVisibleCount(prev => prev + 10)} className="w-full py-4 rounded-xl text-sm font-bold text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">Load More Transactions <ChevronDown className="w-4 h-4" /></button></div>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
                            <h2 className="text-2xl font-black mb-2">Account Settings</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Manage your personal profile, security and preferences.</p>

                            <div className="space-y-6">
                                {/* Profile Information Card */}
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                                            <UserCircle className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-lg font-bold">Profile Information</h3>
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                                        <div className="relative group self-center md:self-auto">
                                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-slate-50 dark:border-slate-800 shadow-xl">
                                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="Profile" className="w-full h-full object-cover" />
                                            </div>
                                            <button className="absolute bottom-1 right-1 p-2 bg-slate-900 text-white rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform">
                                                <Camera className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex-1 space-y-4 w-full">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Display Name</label>
                                                    <input type="text" defaultValue="John Doe" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary font-semibold" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Username</label>
                                                    <input type="text" defaultValue="@johndoe_official" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary font-semibold" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Short Bio</label>
                                                <textarea rows={2} defaultValue="Building the future of fintech with Zely. Adventure seeker and coffee enthusiast." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary font-medium resize-none" />
                                            </div>
                                            <button className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm hover:opacity-90 transition-opacity">Save Profile Changes</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Email Card */}
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-5 sm:p-8 shadow-sm transition-all duration-300">
                                    {!isChangingEmail ? (
                                        <div className="flex flex-row items-center justify-between gap-3 sm:gap-6 animate-in fade-in">
                                            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                    <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm sm:text-lg font-bold truncate">Email Address</h3>
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black uppercase">
                                                            <ShieldCheck className="w-2.5 h-2.5" /> Verified
                                                        </div>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-slate-500 font-medium truncate">john.doe@example.com</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsChangingEmail(true)}
                                                className="px-3 py-2 sm:px-6 sm:py-2 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                                            >
                                                Change Email
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleEmailUpdate} className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-bold flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> Update Email Address</h3>
                                                <button type="button" onClick={() => setIsChangingEmail(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">New Email Address</label>
                                                    <input
                                                        type="email"
                                                        value={newEmail}
                                                        onChange={(e) => setNewEmail(e.target.value)}
                                                        placeholder="Enter new email address"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary transition-all font-semibold"
                                                        required
                                                    />
                                                </div>
                                                <div className="flex gap-3 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsChangingEmail(false)}
                                                        className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={isFormSubmitting}
                                                        className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {isFormSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Save"}
                                                    </button>
                                                </div>
                                            </div>
                                        </form>
                                    )}
                                </div>

                                {/* Security Password Card */}
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-5 sm:p-8 shadow-sm transition-all duration-300">
                                    {!isChangingPassword ? (
                                        <div className="flex flex-row items-center justify-between gap-3 sm:gap-6 animate-in fade-in">
                                            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                    <Key className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h3 className="text-sm sm:text-lg font-bold truncate">Security Password</h3>
                                                    <p className="text-xs sm:text-sm text-slate-500 font-medium truncate">Changed 3mo ago</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsChangingPassword(true)}
                                                className="px-3 py-2 sm:px-6 sm:py-2 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                                            >
                                                Change Password
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handlePasswordUpdate} className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-bold flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Reset Account Password</h3>
                                                <button type="button" onClick={() => setIsChangingPassword(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Current Password</label>
                                                    <input
                                                        type="password"
                                                        value={currentPassword}
                                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                                        placeholder="••••••••"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary transition-all"
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">New Password</label>
                                                        <input
                                                            type="password"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                            placeholder="••••••••"
                                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary transition-all"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Confirm New Password</label>
                                                        <input
                                                            type="password"
                                                            value={confirmNewPassword}
                                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                            placeholder="••••••••"
                                                            className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary transition-all ${newPassword && confirmNewPassword && newPassword !== confirmNewPassword ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsChangingPassword(false)}
                                                        className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={isFormSubmitting || (newPassword && confirmNewPassword && newPassword !== confirmNewPassword)}
                                                        className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {isFormSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                                                    </button>
                                                </div>
                                            </div>
                                        </form>
                                    )}
                                </div>

                                {/* Active Sessions Card */}
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                                <Smartphone className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-lg font-bold">Active Sessions</h3>
                                        </div>
                                        <button
                                            onClick={handleLogoutAllOther}
                                            className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                                        >
                                            Logout all other devices
                                        </button>
                                    </div>
                                    <div className="space-y-6">
                                        {sessions.map(session => (
                                            <div key={session.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                                        <session.icon className="w-5 h-5 text-slate-500" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-900 dark:text-white">{session.device} • {session.browser}</p>
                                                            {session.isCurrent && (
                                                                <span className="px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-500 text-[10px] font-black uppercase">Current</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-medium">{session.location} • {session.lastActive}</p>
                                                    </div>
                                                </div>
                                                {!session.isCurrent && (
                                                    <button
                                                        onClick={() => handleLogoutSession(session.id)}
                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                                                    >
                                                        <LogOut className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Notification Preferences Card */}
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-xl">
                                            <BellRing className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-lg font-bold">Notification Preferences</h3>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-slate-900 dark:text-white">Email Notifications</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Receive alerts for account activity via email.</p>
                                            </div>
                                            <button onClick={() => setEmailNotifs(!emailNotifs)} className={`relative h-6 w-11 rounded-full transition-colors ${emailNotifs ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${emailNotifs ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-slate-900 dark:text-white">Push Notifications</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Enable real-time mobile app alerts.</p>
                                            </div>
                                            <button onClick={() => setPushNotifs(!pushNotifs)} className={`relative h-6 w-11 rounded-full transition-colors ${pushNotifs ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${pushNotifs ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-slate-900 dark:text-white">Marketing Emails</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Stay updated with our latest news and offers.</p>
                                            </div>
                                            <button onClick={() => setMarketingNotifs(!marketingNotifs)} className={`relative h-6 w-11 rounded-full transition-colors ${marketingNotifs ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${marketingNotifs ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Regional Card */}
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                            <Globe className="w-5 h-5" />
                                        </div>
                                        <h3 className="text-lg font-bold">Regional & Language</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <CustomDropdown
                                            label="Language"
                                            value={language}
                                            options={[
                                                { value: 'en-US', label: 'English (US)', icon: Languages },
                                                { value: 'es-ES', label: 'Spanish (ES)', icon: Languages },
                                                { value: 'fr-FR', label: 'French (FR)', icon: Languages },
                                                { value: 'de-DE', label: 'German (DE)', icon: Languages },
                                            ]}
                                            onChange={setLanguage}
                                        />
                                        <CustomDropdown
                                            label="Region"
                                            value={region}
                                            options={[
                                                { value: 'us', label: 'United States', icon: MapPin },
                                                { value: 'uk', label: 'United Kingdom', icon: MapPin },
                                                { value: 'ca', label: 'Canada', icon: MapPin },
                                                { value: 'de', label: 'Germany', icon: MapPin },
                                            ]}
                                            onChange={setRegion}
                                        />
                                    </div>
                                </div>

                                {/* 2FA Card */}
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                                    <div className="p-5 sm:p-8">
                                        <div className="flex flex-row items-center justify-between gap-4 mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex gap-3 sm:gap-4 overflow-hidden">
                                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${is2FAEnabled ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                                    <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h3 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate">Two-Factor Auth</h3>
                                                    <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400 font-medium truncate">Extra security for your login.</p>
                                                    <p className="sm:hidden text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Layer 2 protection</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={toggle2FA}
                                                disabled={is2FALoading}
                                                className={`relative inline-flex h-7 w-12 sm:h-8 sm:w-14 items-center rounded-full transition-all duration-300 focus:outline-none shrink-0 ${is2FAEnabled ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <span className={`inline-block h-5 w-5 sm:h-6 sm:w-6 transform rounded-full bg-white transition-all duration-300 shadow-md ${is2FAEnabled ? 'translate-x-6 sm:translate-x-7' : 'translate-x-1'}`}>
                                                    {is2FALoading && <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 text-primary animate-spin m-1" />}
                                                </span>
                                            </button>
                                        </div>

                                        <div className="mt-4 space-y-4">
                                            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                                                <div className="space-y-0.5">
                                                    <h4 className="font-bold text-sm">Backup Codes</h4>
                                                    <p className="text-xs text-slate-500">Access your account if you lose your phone.</p>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <button onClick={() => setShowBackupCodesModal(true)} className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">View Codes</button>
                                                    <button onClick={handleDownloadBackupCodes} className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                                                        <Download className="w-3.5 h-3.5" /> Download (.txt)
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {!is2FAEnabled && !show2FASetup && (
                                            <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 flex flex-col items-center text-center mt-8">
                                                <Phone className="w-10 h-10 text-blue-500 mb-4" />
                                                <h4 className="font-bold text-slate-900 dark:text-white mb-2">2FA is currently disabled</h4>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">Using an authenticator app for 2FA provides a more secure way to sign in compared to SMS.</p>
                                                <button onClick={() => setShow2FASetup(true)} className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all transform active:scale-[0.98]">
                                                    Setup 2FA Now
                                                </button>
                                            </div>
                                        )}

                                        {show2FASetup && (
                                            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 mt-8">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-sm">1</div>
                                                            <h4 className="font-bold">Scan QR Code</h4>
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-medium">Open your authenticator app (like Google Authenticator or Authy) and scan this code.</p>
                                                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm w-fit mx-auto lg:mx-0 group cursor-pointer relative overflow-hidden">
                                                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                            <QrCode className="w-40 h-40 text-slate-900 relative z-10" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-sm">2</div>
                                                            <h4 className="font-bold">Manual Entry Option</h4>
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-medium">If you can't scan the QR code, enter this secret key manually into your app.</p>
                                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                                            <code className="text-sm font-mono font-bold tracking-wider text-primary">JBSW Y3DP EBLX A3IT</code>
                                                            <button
                                                                onClick={handleCopyKey}
                                                                className={`p-2 rounded-lg transition-all ${isKeyCopied ? 'bg-green-500 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400'}`}
                                                            >
                                                                {isKeyCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-sm">3</div>
                                                        <h4 className="font-bold">Test 2FA Connection</h4>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row gap-4 items-center max-w-md">
                                                        <div className="relative w-full">
                                                            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                maxLength={6}
                                                                value={test2FACode}
                                                                onChange={(e) => setTest2FACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                                placeholder="Enter 6-digit code"
                                                                className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-xl py-3 pl-12 pr-4 font-mono font-black text-lg focus:outline-none transition-all ${testResult === 'success' ? 'border-green-500 ring-4 ring-green-500/10' : testResult === 'error' ? 'border-red-500 animate-shake ring-4 ring-red-500/10' : 'border-slate-200 dark:border-slate-700 focus:border-primary'}`}
                                                            />
                                                            {testResult === 'success' && <CheckCircle2 className="absolute right-4 top-3.5 w-6 h-6 text-green-500 animate-in zoom-in" />}
                                                            {testResult === 'error' && <XCircle className="absolute right-4 top-3.5 w-6 h-6 text-red-500 animate-in zoom-in" />}
                                                        </div>
                                                        <button
                                                            onClick={handleVerifyTestCode}
                                                            disabled={test2FACode.length !== 6 || isTestingCode}
                                                            className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 dark:bg-primary text-white font-bold rounded-xl whitespace-nowrap hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                                                        >
                                                            {isTestingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Activate 2FA'}
                                                        </button>
                                                    </div>
                                                    {testResult === 'error' && <p className="text-xs text-red-500 font-bold mt-2">The code you entered is invalid. Hint: Use 123456</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'home' && activeTab !== 'activity' && activeTab !== 'settings' && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 animate-in fade-in duration-300">
                            <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4"><Activity className="w-12 h-12 text-slate-400 dark:text-slate-500" /></div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Coming Soon</h3>
                            <p>The {activeTab} section is under development.</p>
                            <button onClick={() => setActiveTab('home')} className="mt-6 px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors">Go Back Home</button>
                        </div>
                    )}
                </div>
            </main>

            {/* MODALS */}
            {showBackupCodesModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-lg">
                                    <ShieldAlert className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-bold">Backup Codes</h3>
                            </div>
                            <button onClick={() => setShowBackupCodesModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 mb-6 border border-slate-100 dark:border-slate-700/50">
                            <div className="grid grid-cols-2 gap-4">
                                {backupCodes.map((code, idx) => (
                                    <div key={idx} className="font-mono text-center py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 font-bold text-slate-900 dark:text-white tracking-widest text-sm shadow-sm select-all">
                                        {code}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                                    Backup codes allow you to access your account if you lose your authentication device. Keep them in a safe, offline location. Each code can be used <span className="font-bold underline">once</span>.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(backupCodes.join('\n'));
                                        showToast('success', "All codes copied to clipboard.");
                                    }}
                                    className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Copy className="w-4 h-4" /> Copy All
                                </button>
                                <button
                                    onClick={handleDownloadBackupCodes}
                                    className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" /> Download
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSendModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Send Money</h3>
                            <button onClick={resetSendModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        {sendStep === 'input' && (
                            <form onSubmit={handleSendInputSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-500 mb-2">From Account</label>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer" onClick={() => setShowAccountDropdown(!showAccountDropdown)}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary"><Wallet className="w-4 h-4" /></div>
                                            <div><p className="text-sm font-bold">{accountsData[senderAccountIndex].name}</p><p className="text-xs text-slate-500">Balance: {accountsData[senderAccountIndex].currency}{accountsData[senderAccountIndex].balance.toFixed(2)}</p></div>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    </div>
                                    {showAccountDropdown && (
                                        <div className="mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden">
                                            {accountsData.map((acc, idx) => (
                                                <div key={acc.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-3" onClick={() => { setSenderAccountIndex(idx); setShowAccountDropdown(false); }}>
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-600 flex items-center justify-center"><Wallet className="w-4 h-4" /></div>
                                                    <div><p className="text-sm font-bold">{acc.name}</p><p className="text-xs text-slate-500">{acc.currency}{acc.balance.toFixed(2)}</p></div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-500 mb-2">Recipient</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                                        <input type="text" value={sendRecipient} onChange={(e) => setSendRecipient(e.target.value)} placeholder="Name, Email, or ID" className={`w-full bg-slate-50 dark:bg-slate-800 border ${sendErrors.recipient ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl py-3 pl-12 pr-4 font-semibold outline-none focus:ring-2 focus:ring-primary`} />
                                    </div>
                                    {sendErrors.recipient && <p className="text-xs text-red-500 mt-1 font-bold">{sendErrors.recipient}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-500 mb-2">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3.5 font-bold text-slate-400">$</span>
                                        <input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" className={`w-full bg-slate-50 dark:bg-slate-800 border ${sendErrors.amount ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl py-3 pl-12 pr-4 font-bold text-lg outline-none focus:ring-2 focus:ring-primary`} />
                                    </div>
                                    {sendErrors.amount && <p className="text-xs text-red-500 mt-1 font-bold">{sendErrors.amount}</p>}
                                </div>
                                <button type="submit" className="w-full py-3.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-colors">Continue</button>
                            </form>
                        )}
                        {sendStep === 'confirm' && (
                            <div className="text-center space-y-6">
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-primary"><Send className="w-8 h-8 ml-1" /></div>
                                <div><p className="text-slate-500 dark:text-slate-400 font-medium">Sending to <span className="text-slate-900 dark:text-white font-bold">{sendRecipient}</span></p><h2 className="text-4xl font-black mt-2">${Number(sendAmount).toFixed(2)}</h2></div>
                                <div className="flex gap-3"><button onClick={() => setSendStep('input')} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800">Back</button><button onClick={handleConfirmSend} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light">Confirm Send</button></div>
                            </div>
                        )}
                        {sendStep === 'processing' && (
                            <div className="text-center py-10"><Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" /><p className="font-bold text-lg">Processing Transaction...</p></div>
                        )}
                        {sendStep === 'success' && (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-500 mb-4 animate-bounce"><CheckCircle2 className="w-8 h-8" /></div>
                                <h3 className="text-2xl font-black mb-2">Transfer Successful!</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6">You successfully sent ${Number(sendAmount).toFixed(2)} to {sendRecipient}.</p>
                                <button onClick={resetSendModal} className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity">Done</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showReceiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Receive Money</h3>
                            <button onClick={resetReceiveModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100"><QrCode className="w-48 h-48 text-slate-900" /></div>
                            <div className="w-full space-y-4">
                                <div>
                                    <label className="block text-left text-[10px] font-bold text-slate-500 uppercase mb-2">Your Account Number</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-mono font-medium flex items-center">{currentAccount.number}</div>
                                        <button onClick={handleCopyAccount} className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors border border-transparent hover:border-slate-300 dark:hover:border-slate-600" title="Copy Account Number">{isAccountCopied ? <Check className="w-4 h-4 text-green-500" /> : <CardIcon className="w-4 h-4" />}</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-left text-[10px] font-bold text-slate-500 uppercase mb-2">Personal Payment Link</label>
                                    <div className="flex gap-2">
                                        <input readOnly value={`https://framergen.app/pay/john_doe`} className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-500 outline-none" />
                                        <button onClick={handleCopyLink} className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors border border-transparent hover:border-slate-300 dark:hover:border-slate-600" title="Copy Link">{isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 px-4">Show this QR code to the sender or share your unique payment link to receive funds instantly.</p>
                            <button onClick={resetReceiveModal} className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showPayBillsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Pay Bills</h3>
                            <button onClick={resetBillModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        {billStep === 'select' && (
                            <div className="grid grid-cols-2 gap-4">
                                {billProviders.map(provider => (
                                    <button key={provider.id} onClick={() => handleBillProviderSelect(provider.id)} className="flex flex-col items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${provider.color}`}><provider.icon className="w-6 h-6" /></div>
                                        <span className="font-bold text-sm group-hover:text-primary transition-colors">{provider.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {billStep === 'form' && (
                            <form onSubmit={handlePayBill} className="space-y-6">
                                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-6">
                                    {(() => {
                                        const p = billProviders.find(bp => bp.id === selectedBillProvider);
                                        if (!p) return null;
                                        return (
                                            <>
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${p.color}`}><p.icon className="w-5 h-5" /></div>
                                                <div><p className="font-bold text-sm">Paying {p.name}</p><p className="text-xs text-slate-500">Utility Bill</p></div>
                                            </>
                                        )
                                    })()}
                                </div>
                                <div><label className="block text-sm font-bold text-slate-500 mb-2">Account Number</label><input type="text" value={billAccountNum} onChange={(e) => setBillAccountNum(e.target.value)} placeholder="Enter account number" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-semibold outline-none focus:ring-2 focus:ring-primary" required /></div>
                                <div><label className="block text-sm font-bold text-slate-500 mb-2">Amount</label><div className="relative"><span className="absolute left-4 top-3.5 font-bold text-slate-400">$</span><input type="number" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 font-bold text-lg outline-none focus:ring-2 focus:ring-primary" required /></div></div>
                                <div className="flex gap-3"><button type="button" onClick={() => setBillStep('select')} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800">Back</button><button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-light">Pay Now</button></div>
                            </form>
                        )}
                        {billStep === 'processing' && (
                            <div className="text-center py-10"><Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" /><p className="font-bold text-lg">Processing Payment...</p></div>
                        )}
                        {billStep === 'success' && (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-500 mb-4 animate-bounce"><CheckCircle2 className="w-8 h-8" /></div>
                                <h3 className="text-2xl font-black mb-2">Payment Successful!</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6">Your bill has been paid successfully.</p>
                                <button onClick={resetBillModal} className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity">Done</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
                        {showRepeatConfirm && (
                            <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 z-50 rounded-2xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
                                {repeatStep === 'confirm' && (
                                    <>
                                        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle className="w-8 h-8" /></div>
                                        <h3 className="text-xl font-bold mb-2">Repeat Transaction?</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-sm">Are you sure you want to send <span className="font-bold text-slate-900 dark:text-white">${selectedTransaction.amount.toFixed(2)}</span> to <span className="font-bold text-slate-900 dark:text-white">{selectedTransaction.recipientName || 'this recipient'}</span> again?</p>
                                        <div className="flex gap-3 w-full"><button onClick={handleCloseRepeatModal} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button><button onClick={executeRepeatTransaction} className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90">Confirm</button></div>
                                    </>
                                )}
                                {repeatStep === 'processing' && <div className="text-center"><Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" /><p className="font-bold text-lg">Transaction in process...</p></div>}
                                {repeatStep === 'success' && <div className="text-center"><div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-500 mb-4 animate-bounce"><CheckCircle2 className="w-8 h-8" /></div><h3 className="text-xl font-black mb-2">Transaction Successful!</h3><button onClick={handleCloseRepeatModal} className="mt-4 px-6 py-2 bg-primary text-white rounded-lg font-bold">Close</button></div>}
                            </div>
                        )}
                        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Transaction Details</h3><button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button></div>
                        <div className="text-center mb-6"><h2 className="text-3xl font-black mb-1">{selectedTransaction.type === 'incoming' ? '+' : '-'}${selectedTransaction.amount.toFixed(2)}</h2><p className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-block ${selectedTransaction.status === 'success' ? 'bg-green-100 text-green-600' : selectedTransaction.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>{selectedTransaction.status}</p></div>
                        {selectedTransaction.merchantDetails && (
                            <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"><div className={`h-24 w-full ${selectedTransaction.merchantDetails.mapPlaceholderColor || 'bg-slate-200'} flex items-center justify-center relative`}><MapPin className="w-6 h-6 text-white drop-shadow-md" /></div><div className="p-3 bg-slate-50 dark:bg-slate-800 text-xs"><p className="font-bold text-slate-900 dark:text-white">{selectedTransaction.merchantDetails.name}</p><p className="text-slate-500 truncate">{selectedTransaction.merchantDetails.address}</p></div></div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm mb-6">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"><span className="text-slate-500 text-xs block mb-0.5">Date</span><span className="font-bold text-slate-900 dark:text-white">{formatDate(selectedTransaction.date)}</span></div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"><span className="text-slate-500 text-xs block mb-0.5">{selectedTransaction.type === 'incoming' ? 'From' : 'To'}</span><span className="font-bold text-slate-900 dark:text-white truncate block">{selectedTransaction.recipientName || 'Unknown'}</span></div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg col-span-2 flex justify-between items-center relative"><div className="flex-1"><span className="text-slate-500 text-xs block mb-0.5">Category</span>{isEditingCategory ? (
                                <div className="relative"><button type="button" className="w-full text-left font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 flex justify-between items-center text-xs" onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}>{selectedTransaction.category}{showCategoryDropdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button>{showCategoryDropdown && <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 max-h-32 overflow-y-auto no-scrollbar">{PREDEFINED_CATEGORIES.map(cat => (<button key={cat} className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 font-medium ${selectedTransaction.category === cat ? 'text-primary bg-primary/5' : 'text-slate-700 dark:text-slate-300'}`} onClick={() => handleUpdateCategory(cat)}>{cat}</button>))}</div>}</div>
                            ) : (<span className="font-bold text-slate-900 dark:text-white">{selectedTransaction.category}</span>)}</div>{!isEditingCategory && <button onClick={() => setIsEditingCategory(true)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"><Edit2 className="w-3.5 h-3.5" /></button>}</div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg col-span-2"><span className="text-slate-500 text-xs block mb-0.5">Transaction ID</span><span className="font-mono text-xs font-bold text-slate-900 dark:text-white break-all">{selectedTransaction.id}</span></div>
                            {selectedTransaction.notes && <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg col-span-2"><span className="text-slate-500 text-xs block mb-0.5">Notes</span><span className="font-medium text-slate-900 dark:text-white text-xs">{selectedTransaction.notes}</span></div>}
                        </div>
                        <button onClick={handleRepeatTransaction} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"><RotateCw className="w-4 h-4" />Repeat Transaction</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardScreen;
