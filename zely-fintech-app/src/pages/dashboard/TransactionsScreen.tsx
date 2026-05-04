
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, ArrowDownLeft, ArrowUpRight, Calendar, SlidersHorizontal, ArrowDownWideNarrow, ArrowUpNarrowWide, Download, ChevronDown, Loader2 } from 'lucide-react';
import { generateMockData } from '../../utils/mockData';
import { Transaction } from '../../utils/types';
import TransactionDetailsModal from '../../components/TransactionDetailsModal';

const TransactionsScreen: React.FC = () => {
    const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [visibleCount, setVisibleCount] = useState(10);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // State for transactions
    const [transactions, setTransactions] = useState<Transaction[]>(() => generateMockData());
    
    // API Call Preparation (Commented out for production use later)
    /*
    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                // const response = await fetch('/api/user/transactions');
                // if(response.ok) {
                //    const data = await response.json();
                //    setTransactions(data);
                // }
            } catch (error) {
                console.error("Failed to load transactions", error);
            }
        };
        fetchTransactions();
    }, []);
    */

    // Reset pagination when filters change
    useEffect(() => {
        setVisibleCount(10);
    }, [filter, searchQuery, sortOrder]);

    // Filter Logic
    const filteredTransactions = transactions.filter(tx => {
        const matchesFilter = filter === 'all' || tx.type === filter;
        const query = searchQuery.toLowerCase();
        const matchesSearch = (tx.title && tx.title.toLowerCase().includes(query)) || 
                              (tx.recipientName && tx.recipientName.toLowerCase().includes(query)) ||
                              (tx.category && tx.category.toLowerCase().includes(query)) ||
                              (tx.amount && tx.amount.toString().includes(query));
        return matchesFilter && matchesSearch;
    });

    // Sort Logic
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Slice for pagination
    const displayedTransactions = sortedTransactions.slice(0, visibleCount);

    // Group by Date
    const groupedTransactions = displayedTransactions.reduce((acc, tx) => {
        const date = new Date(tx.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const handleExportCSV = () => {
        if (sortedTransactions.length === 0) return;

        const headers = ['Date', 'Title', 'Category', 'Amount (NGN)', 'Type', 'Status', 'Reference ID'];
        const csvRows = [headers.join(',')];

        for (const tx of sortedTransactions) {
            // Escape double quotes by doubling them
            const escape = (text: string) => `"${text.replace(/"/g, '""')}"`;
            
            const row = [
                escape(new Date(tx.date).toLocaleDateString()),
                escape(tx.title),
                escape(tx.category),
                escape(tx.amount.toString()),
                escape(tx.type),
                escape(tx.status),
                escape(tx.id)
            ];
            csvRows.push(row.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleShowMore = () => {
        setIsLoadingMore(true);
        // Simulate network delay for better UX feel
        setTimeout(() => {
            setVisibleCount(prev => prev + 10);
            setIsLoadingMore(false);
        }, 600);
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Transaction History</h2>
                <div className="flex items-center gap-2">
                    <div className="relative group flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary w-full sm:w-56 transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 flex items-center gap-2 group relative"
                        title={sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                    >
                        {sortOrder === 'desc' ? <ArrowDownWideNarrow className="w-4 h-4" /> : <ArrowUpNarrowWide className="w-4 h-4" />}
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        disabled={sortedTransactions.length === 0}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 flex items-center gap-2 group relative disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Export CSV"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {['all', 'incoming', 'outgoing'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all ${
                            filter === f 
                            ? 'bg-primary text-white shadow-sm' 
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        {f === 'all' ? 'All' : f}
                    </button>
                ))}
            </div>

            <div className="space-y-5 pb-12">
                {Object.keys(groupedTransactions).length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                            <Search className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">No transactions found</h3>
                        <p className="text-slate-500 text-xs mt-1">Try adjusting your filters.</p>
                    </div>
                ) : (
                    <>
                        {Object.entries(groupedTransactions).map(([date, txs]) => (
                            <div key={date} className="animate-in fade-in slide-in-from-bottom-2">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{date}</h3>
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                    {(txs as Transaction[]).map((tx) => (
                                        <div 
                                            key={tx.id} 
                                            onClick={() => setSelectedTransaction(tx)}
                                            className="p-3 sm:p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                                    tx.type === 'incoming' 
                                                        ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {tx.type === 'incoming' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-primary transition-colors">{tx.title}</h4>
                                                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{tx.category}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold text-xs sm:text-sm ${tx.type === 'incoming' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                                                    {tx.type === 'incoming' ? '+' : '-'}₦{Math.abs(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                                <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
                                                    tx.status === 'success' ? 'text-green-500' : tx.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
                                                }`}>{tx.status}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {visibleCount < sortedTransactions.length && (
                            <div className="flex justify-center pt-2">
                                <button 
                                    onClick={handleShowMore}
                                    disabled={isLoadingMore}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed group"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                            <span>Loading...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Show More</span>
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <TransactionDetailsModal 
                transaction={selectedTransaction} 
                onClose={() => setSelectedTransaction(null)} 
            />
        </div>
    );
};

export default TransactionsScreen;
    