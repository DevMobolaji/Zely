
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken, clearTokens } from '../utils/api';
import { Loader2 } from 'lucide-react';

interface AuthState {
    accessToken: string | null;
    user: {
        role: string;
    };
}

interface AuthContextType {
    auth: AuthState;
    setAuth: React.Dispatch<React.SetStateAction<AuthState>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Utility for simulating API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [auth, setAuth] = useState<AuthState>({ accessToken: null, user: { role: '' } });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = getAccessToken();
            const storedRole = localStorage.getItem('userRole');
            
            // 1. Check memory first
            if (token && storedRole) {
                setAuth({ accessToken: token, user: { role: storedRole } });
                setIsLoading(false);
                return;
            }

            // 2. Check refresh token availability
            const refreshToken = getRefreshToken();
            
            // If neither memory token nor refresh token, stop.
            if (!refreshToken) {
                setIsLoading(false);
                return;
            }

            try {
                // SIMULATION: Replace real API call with delay to avoid Network Error
                /* PRODUCTION CODE
                const response = await axiosPrivate.post('/auth/refresh', { 
                    refreshToken: refreshToken 
                });
                const { accessToken, role } = response.data;
                */
                
                await delay(800);
                
                // For simulation, we assume any existing refresh token is valid
                const mockAccessToken = 'mock_restored_' + Date.now();
                const userRole = storedRole || 'user';

                setAccessToken(mockAccessToken);
                setAuth({ accessToken: mockAccessToken, user: { role: userRole } });

            } catch (error) {
                console.error("Auth session restore failed:", error);
                clearTokens(); // Cleanup invalid state
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    return (
        <AuthContext.Provider value={{ auth, setAuth }}>
            {isLoading ? (
                <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-black text-slate-900 dark:text-white">
                    <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm font-semibold text-slate-500">Restoring secure session...</p>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
