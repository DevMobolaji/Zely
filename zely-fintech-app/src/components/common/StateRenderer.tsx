
import React from 'react';
import { Loader2, AlertCircle, PackageOpen } from 'lucide-react';

interface StateRendererProps {
    loading: boolean;
    error: string | null;
    data: any;
    isEmpty?: boolean;
    onRetry?: () => void;
    children: React.ReactNode;
    loadingComponent?: React.ReactNode;
    emptyMessage?: string;
}

const StateRenderer: React.FC<StateRendererProps> = ({
    loading,
    error,
    data,
    isEmpty,
    onRetry,
    children,
    loadingComponent,
    emptyMessage = "No data found"
}) => {
    
    // 1. Loading State
    if (loading) {
        return loadingComponent || (
            <div className="flex flex-col items-center justify-center py-12 text-primary animate-in fade-in duration-300">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Loading content...</p>
            </div>
        );
    }

    // 2. Error State
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h3>
                <p className="text-sm text-slate-500 mb-4 max-w-xs">{error}</p>
                {onRetry && (
                    <button 
                        onClick={onRetry}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors"
                    >
                        Try Again
                    </button>
                )}
            </div>
        );
    }

    // 3. Empty State (Logic: explicitly empty OR data is empty array)
    const isDataEmpty = isEmpty !== undefined 
        ? isEmpty 
        : (Array.isArray(data) && data.length === 0);

    if (isDataEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <PackageOpen className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">{emptyMessage}</p>
            </div>
        );
    }

    // 4. Success State
    return <>{children}</>;
};

export default StateRenderer;
