
import { axiosPrivate } from '../utils/api'; 
import { clearTokens } from '../utils/api';

// Utility for simulating API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Internal state for simulation progress
let simulationStep = 0;

export const authService = {
  login: async (email: string, password: string): Promise<any> => {
    const response = await axiosPrivate.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (data: any): Promise<any> => {
    const response = await axiosPrivate.post('/auth/register', data);
    return response.data;
  },

  verify: async (code: string, email?: string): Promise<any> => {
    const response = await axiosPrivate.post('/auth/verify', { otp: code, email });
    return response.data;
  },

  resetPasswordRequest: async (email: string): Promise<any> => {
    const response = await axiosPrivate.post('/auth/forgot-password', { email });
    return response.data;
  },

  verifyResetCode: async (email: string, code: string): Promise<any> => {
    const response = await axiosPrivate.post('/auth/confirm-reset-code', { email, otp: code });
    return response.data;
  },

  resetPasswordConfirm: async (data: any): Promise<any> => {
    const response = await axiosPrivate.post('/auth/reset-password', data);
    return response.data;
  },

  getProvisioningStatus: async (signal?: AbortSignal): Promise<any> => {
    /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
    const response = await axiosPrivate.get('/users/provisioning-status', { signal });
    return response.data;
    */

    // SIMULATION: Progress through the state machine
    await delay(1000);

    simulationStep++;

    // Status Transitions based on poll count
    if (simulationStep < 3) return { status: 'ACCOUNT_PROVISION_STARTED' };
    if (simulationStep < 6) return { status: 'WALLETS_CREATED' };

    // Optional: Force a failure at step 7 if it's the first time seeing this screen in the session
    // For this simple implementation, let's just go to success unless simulationStep is specifically manipulated

    if (simulationStep < 9) return { status: 'LEDGERS_CREATED' };
    if (simulationStep < 12) return { status: 'ACCOUNTS_CREATED' };

    return {
      status: 'ACCOUNT_READY',
      checkingAccount: '0123 4455 9900',
      savingsAccount: '0988 2211 5566'
    };
  },

  retryProvisioning: async (): Promise<any> => {
    /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
    const response = await axiosPrivate.post('/users/retry-provision');
    return response.data;
    */

    // SIMULATION
    await delay(1200);
    simulationStep = 0; // Reset progress for the next attempt
    return { success: true };
  },

  logout: async () => {
    try {
      await axiosPrivate.post('/auth/logout');
    } catch (error) {
      console.warn("Logout failed on server, clearing local state.");
    } finally {
      clearTokens();
      window.location.href = '/login';
    }
  }
};
