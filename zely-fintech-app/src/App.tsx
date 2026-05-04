
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './pages/auth/LoginScreen';
import RegisterScreen from './pages/auth/RegisterScreen';
import ResetPasswordScreen from './pages/auth/ResetPasswordScreen';
import TwoFactorScreen from './pages/auth/TwoFactorScreen';
import ProvisioningScreen from './pages/onboarding/ProvisioningScreen';
import DashboardScreen from './pages/dashboard/DashboardScreen';
import WalletsScreen from './pages/dashboard/WalletsScreen';
import TransfersScreen from './pages/dashboard/TransfersScreen';
import TransactionsScreen from './pages/dashboard/TransactionsScreen';
import SettingsScreen from './pages/dashboard/SettingsScreen';
import SavingsScreen from './pages/dashboard/SavingsScreen';
import ProfileScreen from './pages/dashboard/ProfileScreen';
import KYCStatusScreen from './pages/dashboard/KYCStatusScreen';
import KYCTier2Form from './pages/dashboard/KYCTier2Form';
import KYCTier3Form from './pages/dashboard/KYCTier3Form';
import AdminDashboardScreen from './pages/admin/AdminDashboardScreen';
import AdminReconciliationDetailScreen from './pages/admin/AdminReconciliationDetailScreen';
import AdminKYCScreen from './pages/admin/AdminKYCScreen';
import UnauthorizedScreen from './pages/common/UnauthorizedScreen';
import DashboardLayout from './layouts/DashboardLayout';
import RequireAuth from './auth/RequireAuth';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './auth/AuthProvider';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <div className="h-[100dvh] w-full bg-white dark:bg-black text-gray-900 dark:text-gray-100 overflow-hidden relative">
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/register" element={<RegisterScreen />} />
              <Route path="/reset-password" element={<ResetPasswordScreen />} />
              <Route path="/verify" element={<TwoFactorScreen />} />
              <Route path="/unauthorized" element={<UnauthorizedScreen />} />
              
              {/* Protected Onboarding Flow */}
              <Route element={<RequireAuth />}>
                <Route path="/onboarding/provisioning" element={<ProvisioningScreen />} />
              </Route>
              
              {/* Protected User Routes (Wrapped in DashboardLayout) */}
              <Route element={<RequireAuth />}>
                <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<DashboardScreen />} />
                    <Route path="/wallets" element={<WalletsScreen />} />
                    <Route path="/wallets/:walletId" element={<WalletsScreen />} />
                    <Route path="/fund-wallet" element={<TransfersScreen />} />
                    <Route path="/transfers" element={<TransfersScreen />} />
                    <Route path="/transactions" element={<TransactionsScreen />} />
                    <Route path="/savings" element={<SavingsScreen />} />
                    <Route path="/profile" element={<ProfileScreen />} />
                    <Route path="/settings" element={<SettingsScreen />} />
                    <Route path="/kyc" element={<KYCStatusScreen />} />
                    <Route path="/kyc/upgrade/tier-2" element={<KYCTier2Form />} />
                    <Route path="/kyc/upgrade/tier-3" element={<KYCTier3Form />} />
                </Route>
              </Route>
              
              {/* Protected Admin Routes */}
              <Route element={<RequireAuth allowedRoles={['admin']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/admin" element={<AdminDashboardScreen />} />
                  <Route path="/admin/kyc" element={<AdminKYCScreen />} />
                  <Route path="/admin/users" element={<AdminDashboardScreen />} />
                  <Route path="/admin/wallet-funding" element={<AdminDashboardScreen />} />
                  <Route path="/admin/transactions" element={<AdminDashboardScreen />} />
                  <Route path="/admin/audit" element={<AdminDashboardScreen />} />
                  <Route path="/admin/reconciliation" element={<AdminDashboardScreen />} />
                  <Route path="/admin/reconciliation/:runId" element={<AdminReconciliationDetailScreen />} />
                </Route>
              </Route>
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </div>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
