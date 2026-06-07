import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Check,
  Info,
  Menu,
  Moon,
  Shield,
  Sun,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import { useToast } from "../context/ToastContext";
import { authService } from "../services/auth.services";
// import ChatAssistant from '../components/ChatAssistant';
import {
  DashboardDataProvider,
  useDashboardData,
} from "../context/DashboardDataContext";

import { useCallback } from "react";
import {
  BalanceUpdatePayload,
  NotificationPayload,
  useSocket,
} from "../hooks/useSockets";

const DashboardLayoutInner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const {
    wallets,
    loadingWallets,
    refreshWallets,
    transactions,
    loadingTransactions,
    errorTransactions,
    refreshTransactions,
  } = useDashboardData();

  // ✅ Fix: push credit/debit balance updates into notifications too
  const handleBalanceUpdate = useCallback(
    (data: BalanceUpdatePayload) => {
      const isCredit = data.direction === "credit";

      //   showToast(
      //     "success",
      //     isCredit
      //       ? `You received ₦${data.amount.toLocaleString("en-NG")} in your ${data.walletType.replace("_", " ").toLowerCase()}`
      //       : `You sent ₦${data.amount.toLocaleString("en-NG")} from your ${data.walletType.replace("_", " ").toLowerCase()}`,
      //   );

      refreshWallets();
      refreshTransactions();
      //   // 👇 Add to the notifications panel too
      //   setNotifications((prev) => [
      //     {
      //       id: data.transactionId,
      //       type: isCredit ? "credit" : "debit",
      //       title: isCredit ? "Payment Received" : "Payment Sent",
      //       message: isCredit
      //         ? `You received ₦${data.amount.toLocaleString("en-NG")} in your ${data.walletType.replace("_", " ").toLowerCase()}`
      //         : `You sent ₦${data.amount.toLocaleString("en-NG")} from your ${data.walletType.replace("_", " ").toLowerCase()}`,
      //       amount: data.amount,
      //       currency: data.currency,
      //       occurredAt: new Date().toISOString(),
      //     },
      //     ...prev,
      //   ]);
      //   setUnreadCount((prev) => prev + 1);
    },
    [showToast],
  );
  const handleNotification = (data: NotificationPayload) => {
    setNotifications((prev) => [data, ...prev]);
    setUnreadCount((prev) => prev + 1);
    showToast("success", data.message);
  };

  useSocket(handleBalanceUpdate, handleNotification);

  useEffect(() => {
    const isDarkMode =
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleMarkAllRead = () => {
    setUnreadCount(0);
  };

  const handleLogout = async () => {
    await authService.logout();
    showToast("success", "Logged out successfully");
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/admin") return "Admin Overview";
    if (path === "/admin/users") return "User Management";
    if (path === "/admin/transactions") return "Global Transactions";
    if (path === "/admin/wallet-funding") return "Funds Management";
    if (path === "/admin/reconciliation") return "System Reconciliation";
    if (path === "/admin/kyc") return "KYC Verification";
    if (path.includes("/dashboard")) return "Overview";
    if (path.includes("/wallets")) return "My Wallets";
    if (path.includes("/fund-wallet")) return "Fund Wallet";
    if (path.includes("/transfers")) return "Transfers";
    if (path.includes("/transactions")) return "Transactions";
    if (path.includes("/savings")) return "Savings Goals";
    if (path.includes("/profile")) return "My Profile";
    if (path.includes("/settings")) return "Settings";
    return "Overview";
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-black text-slate-900 dark:text-white overflow-hidden font-sans transition-colors duration-300 relative">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        activeTab={location.pathname}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative animate-enter-fade">
        <header className="h-20 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 z-40 gap-4 shrink-0 animate-enter-slide-down">
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex lg:hidden bg-primary p-2 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="shrink-0">
              <h1 className="text-xl font-bold leading-tight tracking-tight">
                {getPageTitle()}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-end">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-full transition-colors shrink-0 ${showNotifications ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ring-1 ring-black/5">
                  <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      Notifications
                    </h3>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-bold text-primary hover:text-primary-dark uppercase tracking-wider flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Mark all read
                    </button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 font-medium">
                          No notifications yet
                        </p>
                      </div>
                    ) : (
                      notifications.map((note, index) => (
                        <div
                          key={index}
                          className="p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex gap-4 cursor-pointer group"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                              note.type === "credit"
                                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                : note.type === "debit"
                                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                  : note.type === "security"
                                    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {note.type === "credit" ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : note.type === "debit" ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : note.type === "security" ? (
                              <Shield className="w-4 h-4" />
                            ) : (
                              <Info className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-0.5">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                {note.title}
                              </h4>
                              <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-2">
                                {new Date(note.occurredAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                              {note.message}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-slate-100 dark:border-slate-800 text-center">
                    <button className="text-xs font-bold text-slate-500 hover:text-primary py-2 w-full transition-colors">
                      View All Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div
              onClick={() => navigate("/profile")}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer shrink-0 hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
            >
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=John"
                alt="Avatar"
                className="w-full h-full"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 pb-24 lg:pb-10 no-scrollbar">
          <Outlet />
        </div>

        {/* <ChatAssistant account={currentAccount} transactions={transactions} userName="John Doe" /> */}
      </main>
    </div>
  );
};

const DashboardLayout: React.FC = () => {
  return <DashboardLayoutInner />;
};

export default DashboardLayout;

// export default DashboardLayout;
// The rule is simple — a component can only consume a context that wraps it from above, never one it renders itself.
