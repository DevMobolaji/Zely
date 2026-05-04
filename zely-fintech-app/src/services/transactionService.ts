
import { generateMockData } from '../utils/mockData';
import { Transaction } from '../utils/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const transactionService = {
    getAll: async (): Promise<Transaction[]> => {
        // API Call Preparation (Commented out for production use later)
        /*
        // const response = await fetch('/api/user/transactions');
        // if (!response.ok) throw new Error('Failed to fetch transactions');
        // return await response.json();
        */
        await delay(800);
        return generateMockData();
    },

    getRecent: async (limit: number = 5): Promise<Transaction[]> => {
        // API Call Preparation (Commented out for production use later)
        /*
        // const response = await fetch(`/api/user/transactions?limit=${limit}`);
        // if (!response.ok) throw new Error('Failed to fetch recent transactions');
        // return await response.json();
        */
        await delay(600);
        return generateMockData().slice(0, limit);
    },

    transfer: async (data: { recipientId?: string, recipientEmail?: string, amount: number, accountId: string, type: 'internal' | 'p2p' }): Promise<any> => {
        // API Call Preparation (Commented out for production use later)
        /*
        // const response = await fetch('/api/user/transactions/transfer', {
        //    method: 'POST',
        //    headers: { 'Content-Type': 'application/json' },
        //    body: JSON.stringify(data)
        // });
        // if (!response.ok) throw new Error('Transfer failed');
        // return await response.json();
        */
        await delay(1500);
        return { success: true, reference: 'TRF' + Date.now() };
    },

    fundWallet: async (data: { amount: number, reference: string, method: string }): Promise<any> => {
        // API Call Preparation (Commented out for production use later)
        /*
        // const response = await fetch('/api/user/wallets/fund', {
        //    method: 'POST',
        //    headers: { 'Content-Type': 'application/json' },
        //    body: JSON.stringify(data)
        // });
        // if (!response.ok) throw new Error('Funding failed');
        // return await response.json();
        */
        await delay(1000);
        return { success: true };
    }
};
