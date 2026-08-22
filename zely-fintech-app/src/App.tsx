import { DashboardDataProvider } from "@/context/DashboardDataContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React from "react";
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import RequireAuth from "./auth/RequireAuth";
import { ToastProvider } from "./context/ToastContext";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminDashboardScreen from "./pages/admin/AdminDashboardScreen";
import AdminKYCScreen from "./pages/admin/AdminKYCScreen";
import AdminReconciliationDetailScreen from "./pages/admin/AdminReconciliationDetailScreen";
import LoginScreen from "./pages/auth/LoginScreen";
import RegisterScreen from "./pages/auth/RegisterScreen";
import ResetPasswordScreen from "./pages/auth/ResetPasswordScreen";
import TwoFactorScreen from "./pages/auth/TwoFactorScreen";
import UnauthorizedScreen from "./pages/common/UnauthorizedScreen";
import DashboardScreen from "./pages/dashboard/DashboardScreen";
import KYCStatusScreen from "./pages/dashboard/KYCStatusScreen";
import KYCTier2Form from "./pages/dashboard/KYCTier2Form";
import KYCTier3Form from "./pages/dashboard/KYCTier3Form";
import ProfileScreen from "./pages/dashboard/ProfileScreen";
import SavingsScreen from "./pages/dashboard/SavingsScreen";
import SettingsScreen from "./pages/dashboard/SettingsScreen";
import TransactionsScreen from "./pages/dashboard/TransactionsScreen";
import TransfersScreen from "./pages/dashboard/TransfersScreen";
import WalletsScreen from "./pages/dashboard/WalletsScreen";
import ProvisioningScreen from "./pages/onboarding/ProvisioningScreen";
import NotificationsScreen from "@/pages/dashboard/NotificationScreen";
import { NotificationProvider } from "@/context/notificationCOntext";
//import UtilityBillsScreen from './pages/dashboard/UtilityBillsScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds — data stays fresh
      gcTime: 5 * 60 * 1000, // 5 minutes — cache kept in memory
      retry: 2, // retry failed requests twice
      refetchOnWindowFocus: true, // refetch when user returns to tab
      refetchOnReconnect: true, // refetch when internet reconnects
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          {/* NotificationProvider removed from here */}
          <div className="min-h-screen w-full bg-white dark:bg-black text-gray-900 dark:text-gray-100 relative">
            <Router>
              <Routes>
                {/* Public Routes — untouched */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/register" element={<RegisterScreen />} />
                <Route
                  path="/reset-password"
                  element={<ResetPasswordScreen />}
                />
                <Route path="/verify" element={<TwoFactorScreen />} />
                {/* <Route path="/unauthorized" element={<UnauthorizedScreen />} /> */}

                {/* Protected Onboarding */}
                <Route element={<RequireAuth />}>
                  <Route
                    path="/onboarding/provisioning"
                    element={<ProvisioningScreen />}
                  />
                  <Route
                    path="/unauthorized"
                    element={<UnauthorizedScreen />}
                  />
                </Route>

                {/* All protected dashboard routes — NotificationProvider lives HERE */}
                <Route element={<RequireAuth />}>
                  <Route
                    element={
                      <NotificationProvider>
                        {" "}
                        {/* ← only mounts when RequireAuth passes */}
                        <DashboardDataProvider>
                          <DashboardLayout />
                        </DashboardDataProvider>
                      </NotificationProvider>
                    }
                  >
                    <Route path="/dashboard" element={<DashboardScreen />} />
                    <Route path="/wallets" element={<WalletsScreen />} />
                    <Route
                      path="/wallets/:walletId"
                      element={<WalletsScreen />}
                    />
                    <Route path="/fund-wallet" element={<TransfersScreen />} />
                    <Route path="/transfers" element={<TransfersScreen />} />
                    <Route
                      path="/transactions"
                      element={<TransactionsScreen />}
                    />
                    <Route path="/savings" element={<SavingsScreen />} />
                    <Route path="/profile" element={<ProfileScreen />} />
                    <Route path="/settings" element={<SettingsScreen />} />
                    <Route path="/kyc" element={<KYCStatusScreen />} />
                    <Route
                      path="/kyc/upgrade/tier-2"
                      element={<KYCTier2Form />}
                    />
                    <Route
                      path="/kyc/upgrade/tier-3"
                      element={<KYCTier3Form />}
                    />
                    <Route
                      path="/notifications"
                      element={<NotificationsScreen />}
                    />{" "}
                    {/* ← moved inside */}
                  </Route>
                </Route>

                {/* Admin Routes — untouched */}
                <Route element={<RequireAuth disallowedRoles={["ADMIN"]} />}>
                  <Route
                    element={
                      <NotificationProvider>
                        <DashboardDataProvider>
                          <DashboardLayout />
                        </DashboardDataProvider>
                      </NotificationProvider>
                    }
                  >
                    <Route path="/dashboard" element={<DashboardScreen />} />
                    <Route path="/wallets" element={<WalletsScreen />} />
                    <Route
                      path="/wallets/:walletId"
                      element={<WalletsScreen />}
                    />
                    <Route path="/fund-wallet" element={<TransfersScreen />} />
                    <Route path="/transfers" element={<TransfersScreen />} />
                    <Route
                      path="/transactions"
                      element={<TransactionsScreen />}
                    />
                    <Route path="/savings" element={<SavingsScreen />} />
                    <Route path="/profile" element={<ProfileScreen />} />
                    <Route path="/settings" element={<SettingsScreen />} />
                    <Route path="/kyc" element={<KYCStatusScreen />} />
                    <Route
                      path="/kyc/upgrade/tier-2"
                      element={<KYCTier2Form />}
                    />
                    <Route
                      path="/kyc/upgrade/tier-3"
                      element={<KYCTier3Form />}
                    />
                    <Route
                      path="/notifications"
                      element={<NotificationsScreen />}
                    />
                  </Route>
                </Route>

                {/* Admin Routes — only admins allowed */}
                <Route element={<RequireAuth allowedRoles={["ADMIN"]} />}>
                  <Route
                    element={
                      <NotificationProvider>
                        <DashboardDataProvider>
                          <DashboardLayout />
                        </DashboardDataProvider>
                      </NotificationProvider>
                    }
                  >
                    <Route path="/admin" element={<AdminDashboardScreen />} />
                    <Route path="/admin/kyc" element={<AdminKYCScreen />} />
                    <Route
                      path="/admin/users"
                      element={<AdminDashboardScreen />}
                    />
                    <Route
                      path="/admin/wallet-funding"
                      element={<AdminDashboardScreen />}
                    />
                    <Route
                      path="/admin/transactions"
                      element={<AdminDashboardScreen />}
                    />
                    <Route
                      path="/admin/audit"
                      element={<AdminDashboardScreen />}
                    />
                    <Route
                      path="/admin/reconciliation"
                      element={<AdminDashboardScreen />}
                    />
                    <Route
                      path="/admin/reconciliation/:runId"
                      element={<AdminReconciliationDetailScreen />}
                    />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Router>
          </div>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};
export default App;
