import axios from "axios";
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
} from "../utils/api";

// Defined as requested
export const axiosPrivate = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Request Interceptor that binds the access token to each request
axiosPrivate.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor that handles 401 errors and attempts token refresh
// client.ts
let refreshPromise: Promise<string> | null = null; // 👈 shared across all requests

axiosPrivate.interceptors.response.use(
  (response) => response,
  async (error) => {
    const prevRequest = error?.config;

    if (error?.response?.status === 401 && !prevRequest?.sent) {
      prevRequest.sent = true;

      try {
        // 👇 If a refresh is already in flight, wait for it — don't fire another
        if (!refreshPromise) {
          refreshPromise = axiosPrivate
            .post("/auth/refresh", { refreshToken: getRefreshToken() })
            .then((res) => {
              const newAccessToken = res.data.user.accessToken;
              const newRefreshToken = res.data.user.refreshToken;
              setAccessToken(newAccessToken);
              if (newRefreshToken) setRefreshToken(newRefreshToken);
              return newAccessToken;
            })
            .finally(() => {
              refreshPromise = null; // 👈 clear after done
            });
        }

        const newAccessToken = await refreshPromise; // all queued requests wait here
        prevRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return axiosPrivate(prevRequest);
      } catch (refreshError) {
        refreshPromise = null;
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// Default export for compatibility if needed, though mostly using axiosPrivate
export default axiosPrivate;
