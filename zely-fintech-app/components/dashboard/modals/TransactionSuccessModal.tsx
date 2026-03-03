
import React from 'react';
import { CheckCircle2, Download, Share2 } from 'lucide-react';

interface TransactionSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: string;
    recipient: string;
    onViewReceipt?: () => void;
}

const TransactionSuccessModal: React.FC<TransactionSuccessModalProps> = ({ isOpen, onClose, amount, recipient, onViewReceipt }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Background decoration */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-500"></div>
                
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/10">
                    <CheckCircle2 className="w-10 h-10 text-green-500 animate-bounce" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Success!</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
                    You have successfully sent <br />
                    <span className="text-3xl font-black text-slate-900 dark:text-white block mt-3 mb-1 tracking-tight">${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-sm font-semibold text-slate-400 block">to <span className="text-slate-800 dark:text-slate-200">{recipient}</span></span>
                </p>

                <div className="space-y-3">
                    <button 
                        onClick={onClose} 
                        className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform active:scale-[0.98]"
                    >
                        Done
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={onViewReceipt}
                            className="py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                            <Download className="w-4 h-4" /> Receipt
                        </button>
                        <button className="py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm">
                            <Share2 className="w-4 h-4" /> Share
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionSuccessModal;
