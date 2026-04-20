
import apiClient from '../api/client';
import { Transaction, ApiResponse } from '../types';
import { generateMockData } from '../utils/mockData';

// Simulation utility to mimic network latency
const simulateDelay = <T>(data: T, ms = 800): Promise<{ data: T }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ data });
        }, ms);
    });
};

export const transactionService = {
    // Get all transactions
    getAll: async (): Promise<Transaction[]> => {
        // PROD: return apiClient.get<ApiResponse<Transaction[]>>('/transactions').then(res => res.data.data);
        
        // MOCK:
        const mockData = generateMockData();
        const response = await simulateDelay(mockData);
        return response.data;
    },

    // Get recent transactions (limit)
    getRecent: async (limit: number = 5): Promise<Transaction[]> => {
        // PROD: return apiClient.get<ApiResponse<Transaction[]>>(`/transactions?limit=${limit}`).then(res => res.data.data);
        
        // MOCK:
        const mockData = generateMockData().slice(0, limit);
        const response = await simulateDelay(mockData, 500); // Faster loading for dashboard
        return response.data;
    },

    // Create a transfer
    transfer: async (recipientId: string, amount: number, accountId: string): Promise<{ success: boolean; message: string }> => {
        // PROD: return apiClient.post('/transactions/transfer', { recipientId, amount, accountId });
        
        // MOCK:
        await simulateDelay(null, 1500);
        return { success: true, message: 'Transfer successful' };
    }
};
