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

  getProvisioningStatus: async (): Promise<{
    ok: boolean;
    status: string;
    ready: boolean;
    accounts?: {
      checking: string | null;
      savings: string | null;
    };
  }> => {
    const response = await axiosPrivate.get("/users/provisioning-status");
    return response.data;
  },

  retryProvisioning: async (): Promise<{ ok: boolean }> => {
    const response = await axiosPrivate.post("/users/retry-provisioning");
    return response.data;
  },
};
