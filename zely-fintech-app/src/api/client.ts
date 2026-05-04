
import axios from 'axios';
import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken, clearTokens } from '../utils/api';

// Defined as requested
export const axiosPrivate = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

// Request Interceptor
axiosPrivate.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor
axiosPrivate.interceptors.response.use(
    (response) => response,
    async (error) => {
        const prevRequest = error?.config;
        
        // 401 loop prevention
        if (error?.response?.status === 401 && !prevRequest?.sent) {
            prevRequest.sent = true;
            
            try {
                // Attempt refresh
                // Note: withCredentials: true implies cookies might be used for refresh token,
                // but we also send it in body if available in storage as fallback/hybrid support.
                const refreshToken = getRefreshToken();
                
                const response = await axiosPrivate.post('/auth/refresh', { 
                    refreshToken: refreshToken 
                });

                const newAccessToken = response.data.accessToken;
                const newRefreshToken = response.data.refreshToken;

                setAccessToken(newAccessToken);
                if (newRefreshToken) setRefreshToken(newRefreshToken);

                prevRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return axiosPrivate(prevRequest);
            } catch (refreshError) {
                // Logout on fail
                clearTokens();
                window.location.href = '/login'; // Hard redirect
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

// Default export for compatibility if needed, though mostly using axiosPrivate
export default axiosPrivate;
