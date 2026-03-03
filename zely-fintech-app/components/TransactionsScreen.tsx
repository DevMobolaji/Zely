
import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowDownLeft, ArrowUpRight, Calendar, SlidersHorizontal, ArrowDownWideNarrow, ArrowUpNarrowWide, Download } from 'lucide-react';
import { generateMockData } from '../utils/mockData';
import { Transaction } from '../utils/types';
import TransactionDetailsModal from './TransactionDetailsModal';

const TransactionsScreen: React.FC = () => {
    const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    
    // Use memo to prevent regenerating mock data on every render (which updates Date.now())
    const transactions = useMemo(() => generateMockData(), []);

    // Filter Logic
    const filteredTransactions = transactions.filter(tx => {
        const matchesFilter = filter === 'all' || tx.type === filter;
        const matchesSearch = tx.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (tx.recipientName && tx.recipientName.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    // Sort Logic
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Group by Date
    const groupedTransactions = sortedTransactions.reduce((acc, tx) => {
        const date = new Date(tx.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const handleExportCSV = () => {
        if (sortedTransactions.length === 0) return;

        const headers = ['Date', 'Title', 'Category', 'Amount', 'Type', 'Status', 'Reference ID'];
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

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold">Transaction History</h2>
                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search transactions..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary w-full sm:w-64 transition-all"
                        />
                    </div>
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 flex items-center gap-2 group relative"
                        title={sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                    >
                        {sortOrder === 'desc' ? <ArrowDownWideNarrow className="w-5 h-5" /> : <ArrowUpNarrowWide className="w-5 h-5" />}
                        <span className="hidden sm:inline text-xs font-bold">Sort</span>
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        disabled={sortedTransactions.length === 0}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 flex items-center gap-2 group relative disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Export CSV"
                    >
                        <Download className="w-5 h-5" />
                        <span className="hidden sm:inline text-xs font-bold">Export</span>
                    </button>
                </div>
            </div>

            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {['all', 'incoming', 'outgoing'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-4 py-2 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-all ${
                            filter === f 
                            ? 'bg-primary text-white shadow-sm' 
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        {f === 'all' ? 'All Transactions' : f}
                    </button>
                ))}
            </div>

            <div className="space-y-6">
                {Object.keys(groupedTransactions).length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 border-dashed">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Search className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No transactions found</h3>
                        <p className="text-slate-500 text-sm">Try adjusting your filters or search query.</p>
                    </div>
                ) : (
                    Object.entries(groupedTransactions).map(([date, txs]) => (
                        <div key={date}>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-2">{date}</h3>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                {(txs as Transaction[]).map((tx) => (
                                    <div 
                                        key={tx.id} 
                                        onClick={() => setSelectedTransaction(tx)}
                                        className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                                tx.type === 'incoming' 
                                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                {tx.type === 'incoming' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-primary transition-colors">{tx.title}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{tx.category}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold text-sm ${tx.type === 'incoming' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                                                {tx.type === 'incoming' ? '+' : '-'}₦{Math.abs(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className={`text-[10px] font-bold uppercase tracking-wider ${
                                                tx.status === 'success' ? 'text-green-500' : tx.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
                                            }`}>{tx.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
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
