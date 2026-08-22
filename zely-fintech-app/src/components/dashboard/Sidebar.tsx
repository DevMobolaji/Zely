import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  List,
  Wallet,
  CreditCard,
  Settings,
  TrendingUp,
  LogOut,
  Activity,
  X,
  PiggyBank,
  ArrowLeftRight,
  Download,
  UserCircle,
  ShieldCheck,
  Users,
  History as HistoryIcon,
  Lightbulb,
} from "lucide-react";
import { authService } from "../../services/auth.services";
import { useAuth } from "../../auth/AuthProvider";

interface SidebarProps {
  activeTab: string;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  handleLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  isSidebarOpen,
  setIsSidebarOpen,
  handleLogout,
}) => {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const handleNav = (path: string) => {
    navigate(path);
    setIsSidebarOpen(false);
  };

  const isActive = (path: string) => {
    if (path === activeTab) return true;
    // Ensure root paths don't catch sub-paths that have their own tabs
    if (path === "/dashboard" || path === "/ADMIN") {
      return activeTab === path;
    }
    return activeTab.startsWith(path + "/");
  };

  const onLogout = async () => {
    await authService.logout();
    handleLogout();
  };

  const menuItems = [
    { path: "/dashboard", icon: Home, label: "Overview" },
    { path: "/wallets", icon: Wallet, label: "Wallets" },
    { path: "/savings", icon: PiggyBank, label: "Savings" },
    { path: "/transfers", icon: ArrowLeftRight, label: "Transfers" },
    //{ path: '/utility-bills', icon: Lightbulb, label: 'Utility Bills' },
    { path: "/fund-wallet", icon: Download, label: "Fund Wallet" },
    { path: "/transactions", icon: List, label: "Transactions" },
    { path: "/kyc", icon: ShieldCheck, label: "Verification" },
    { path: "/profile", icon: UserCircle, label: "Profile" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  // Add Admin links if user is admin
  if (auth.user?.role === "ADMIN") {
    menuItems.length = 0; // Clear for admin focus
    menuItems.push(
      { path: "/admin", icon: Home, label: "Admin Dashboard" },
      { path: "/admin/users", icon: Users, label: "User Management" },
      { path: "/admin/kyc", icon: ShieldCheck, label: "KYC Verification" },
      { path: "/admin/transactions", icon: List, label: "Global Transactions" },
      {
        path: "/admin/wallet-funding",
        icon: Wallet,
        label: "Funds Management",
      },
      { path: "/admin/audit", icon: HistoryIcon, label: "Audit Logs" },
      {
        path: "/admin/reconciliation",
        icon: Activity,
        label: "System Reconciliation",
      },
    );
  }

  return (
    <aside
      className={`fixed lg:sticky inset-y-0 lg:top-0 left-0 flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-full lg:h-screen p-6 justify-between shrink-0 z-50 transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
    >
      <div>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Zely</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <nav className="space-y-1">
          {menuItems.map((item, index) => (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              style={index === 3 ? { height: "60px" } : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive(item.path)
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-200 dark:shadow-none"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Monthly Limit
              </p>
              <p className="text-sm font-bold">75% Used</p>
            </div>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full w-3/4"></div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
