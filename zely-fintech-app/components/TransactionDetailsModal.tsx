
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share2, CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react';
import { Transaction } from '../utils/types';

interface TransactionDetailsModalProps {
    transaction: Transaction | null;
    onClose: () => void;
}

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({ transaction, onClose }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Prevent scrolling on body when modal is open
    useEffect(() => {
        if (transaction) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [transaction]);

    // Don't render anything if not mounted (client-side check) or no transaction
    if (!mounted || !transaction) return null;

    const formatDate = (isoDate: string) => {
        return new Date(isoDate).toLocaleString('en-NG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const modalContent = (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Receipt Header */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex flex-col items-center border-b border-dashed border-slate-200 dark:border-slate-700 relative">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm ${
                        transaction.status === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                        transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                        {transaction.status === 'success' ? <CheckCircle2 className="w-8 h-8" /> :
                         transaction.status === 'pending' ? <Clock className="w-8 h-8" /> :
                         <XCircle className="w-8 h-8" />}
                    </div>
                    
                    <h2 className={`text-3xl font-black mb-1 ${
                        transaction.type === 'incoming' ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'
                    }`}>
                        {transaction.type === 'incoming' ? '+' : '-'}₦{Math.abs(transaction.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </h2>
                    <p className="text-sm font-bold text-slate-500 capitalize">{transaction.status} Transaction</p>
                </div>

                {/* Receipt Body */}
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <span className="text-sm text-slate-500 font-medium">To / From</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white text-right max-w-[200px]">{transaction.recipientName || transaction.title}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 font-medium">Date & Time</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{formatDate(transaction.date)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 font-medium">Category</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">{transaction.category}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 font-medium">Reference ID</span>
                            <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">#{transaction.id.padStart(8, '0')}</span>
                        </div>
                        {transaction.fee !== undefined && (
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500 font-medium">Transaction Fee</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">₦{transaction.fee.toFixed(2)}</span>
                            </div>
                        )}
                        {transaction.merchantDetails && (
                             <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Merchant Location</p>
                                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                                    <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{transaction.merchantDetails.name}</p>
                                        <p className="text-xs text-slate-500">{transaction.merchantDetails.address}</p>
                                    </div>
                                </div>
                             </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm">
                            <Download className="w-4 h-4" /> PDF Receipt
                        </button>
                        <button className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm">
                            <Share2 className="w-4 h-4" /> Share
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default TransactionDetailsModal;
