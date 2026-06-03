import { axiosPrivate } from "../api/client";
import { clearTokens } from "../utils/api";

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  accessToken?: string;
  refreshToken: string;
}

export interface AuthResponse {
  ok: boolean;
  user: AuthUser;
}

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await axiosPrivate.post("/auth/login", {
      email,
      password,
    });
    return response.data;
  },

  register: async (data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ ok: boolean }> => {
    const response = await axiosPrivate.post("/auth/register", data);
    return response.data;
  },

  verify: async (email: string, otp: string): Promise<AuthResponse> => {
    const response = await axiosPrivate.post("/auth/verify", { email, otp });
    return response.data;
  },

  resendVerification: async (email: string): Promise<{ ok: boolean }> => {
    const response = await axiosPrivate.post("/auth/resend-verification", {
      email,
    });
    return response.data;
  },

  resetPasswordRequest: async (email: string): Promise<{ ok: boolean }> => {
    const response = await axiosPrivate.post("/auth/forgot-password", {
      email,
    });
    return response.data;
  },

  verifyResetCode: async (
    email: string,
    otp: string,
  ): Promise<{ ok: boolean }> => {
    const response = await axiosPrivate.post("/auth/confirm-reset-code", {
      email,
      otp,
    });
    return response.data;
  },

  resetPasswordConfirm: async (data: {
    email: string;
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ ok: boolean }> => {
    const response = await axiosPrivate.post("/auth/reset-password", data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await axiosPrivate.post("/auth/logout");
    } catch (e) {
      console.warn("Server logout failed", e);
    } finally {
      clearTokens();
      window.location.href = "/login";
    }
  },

  refreshToken: async (refreshToken: string): Promise<AuthUser> => {
    const response = await axiosPrivate.post("/auth/refresh-token", {
      refreshToken,
    });
    return response.data.user;
  },

  //   verify2FA: async (code: string, email?: string): Promise<any> => {
  //     /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
  //         const response = await axiosPrivate.post('/auth/verify-2fa', { code, email });
  //         return response.data;
  //         */

  //     // SIMULATION
  //     await delay(1200);
  //     // Any 6-digit code works except '000000'
  //     if (code === "000000") {
  //       throw {
  //         response: {
  //           data: { message: "Invalid verification code" },
  //         },
  //       };
  //     }
  //     return {
  //       accessToken: "mock_access_token_" + Date.now(),
  //       refreshToken: "mock_refresh_token_" + Date.now(),
  //     };
  //   },

  //   getProvisioningStatus: async (signal?: AbortSignal): Promise<any> => {
  //     /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
  //         const response = await axiosPrivate.get('/users/provisioning-status', { signal });
  //         return response.data;
  //         */

  //     // SIMULATION: Progress through the state machine
  //     await delay(1000);

  //     simulationStep++;

  //     // Status Transitions based on poll count
  //     if (simulationStep < 3) return { status: "ACCOUNT_PROVISION_STARTED" };
  //     if (simulationStep < 6) return { status: "WALLETS_CREATED" };

  //     // Optional: Force a failure at step 7 if it's the first time seeing this screen in the session
  //     // For this simple implementation, let's just go to success unless simulationStep is specifically manipulated

  //     if (simulationStep < 9) return { status: "LEDGERS_CREATED" };
  //     if (simulationStep < 12) return { status: "ACCOUNTS_CREATED" };

  //     return {
  //       status: "ACCOUNT_READY",
  //       checkingAccount: "0123 4455 9900",
  //       savingsAccount: "0988 2211 5566",
  //     };
  //   },

  //   retryProvisioning: async (): Promise<any> => {
  //     /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
  //         const response = await axiosPrivate.post('/users/retry-provision');
  //         return response.data;
  //         */

  //     // SIMULATION
  //     await delay(1200);
  //     simulationStep = 0; // Reset progress for the next attempt
  //     return { success: true };
  //   },

  //   resetPasswordRequest: async (email: string): Promise<any> => {
  //     /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
  //         const response = await axiosPrivate.post('/auth/forgot-password', { email });
  //         return response.data;
  //         */

  //     // SIMULATION
  //     await delay(1000);
  //     return {
  //       success: true,
  //       token: {
  //         message:
  //           "Security update: A verification code has been dispatched to your inbox.",
  //       },
  //     };
  //   },

  //   verifyResetCode: async (email: string, code: string): Promise<any> => {
  //     /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
  //         const response = await axiosPrivate.post('/auth/verify-reset-code', { email, code });
  //         return response.data;
  //         */

  //     // SIMULATION
  //     await delay(1000);
  //     if (code === "000000") {
  //       throw {
  //         response: {
  //           data: { message: "Invalid or expired code" },
  //         },
  //       };
  //     }
  //     return { success: true, token: { message: "Code verified successfully." } };
  //   },

  //   resetPasswordConfirm: async (data: any): Promise<any> => {
  //     /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
  //         const response = await axiosPrivate.post('/auth/reset-password', data);
  //         return response.data;
  //         */

  //     // SIMULATION
  //     await delay(1500);
  //     return { success: true };
  //   },

  //   logout: async () => {
  //     try {
  //       /* PRODUCTION CODE - COMMENTED OUT FOR SIMULATION
  //             await axiosPrivate.post('/auth/logout');
  //             */
  //       await delay(500);
  //     } catch (e) {
  //       console.warn("Server logout failed", e);
  //     } finally {
  //       clearTokens();
  //       simulationStep = 0; // Clear simulation progress on logout
  //       window.location.href = "/login";
  //     }
  //   },
};
