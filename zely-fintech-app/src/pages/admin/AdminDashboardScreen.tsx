import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  Download,
  Edit2,
  Filter,
  Globe,
  History as HistoryIcon,
  Loader2,
  Search,
  Settings,
  Shield,
  Square,
  Trash2,
  User as UserIcon,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CustomSelect from "../../components/common/CustomSelect";
import { useToast } from "../../context/ToastContext";
import { authService } from "../../services/auth.services";

type UserStatus = "active" | "suspended" | "pending";
type UserRole = "user" | "admin";

interface UserData {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  role: UserRole;
  joinedDate: string;
  avatarSeed: string;
  balance: number;
}

interface AdminTransaction {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  type: "payment" | "refund" | "transfer" | "credit";
  flow: "in" | "out";
  status: "success" | "failed" | "pending";
  date: string;
}

interface AdminAuditLog {
  id: string;
  action: string;
  target: string;
  adminName: string;
  timestamp: string;
  type: "user" | "funds" | "kyc" | "system";
}

// ... Mock Data ...
const generateMockAuditLogs = (): AdminAuditLog[] => [
  {
    id: "LOG-1",
    action: "User Suspended",
    target: "Bob Johnson (user_3)",
    adminName: "Alice Smith",
    timestamp: "2023-10-25T11:45:00",
    type: "user",
  },
  {
    id: "LOG-2",
    action: "Funds Credited",
    target: "John Doe (user_1) - $500.00",
    adminName: "Alice Smith",
    timestamp: "2023-10-25T10:15:00",
    type: "funds",
  },
  {
    id: "LOG-3",
    action: "KYC Approved",
    target: "Michael Brown (user_5)",
    adminName: "System Auto",
    timestamp: "2023-10-24T16:30:00",
    type: "kyc",
  },
  {
    id: "LOG-4",
    action: "System Settings Updated",
    target: "Transaction Limits",
    adminName: "Alice Smith",
    timestamp: "2023-10-24T09:20:00",
    type: "system",
  },
  {
    id: "LOG-5",
    action: "User Role Changed",
    target: "Emma Wilson (user_4) -> Admin",
    adminName: "Alice Smith",
    timestamp: "2023-10-23T14:10:00",
    type: "user",
  },
];

const generateMockUsers = (): UserData[] => [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    status: "active",
    role: "user",
    joinedDate: "2023-01-15",
    avatarSeed: "John",
    balance: 12450.0,
  },
  {
    id: "2",
    name: "Alice Smith",
    email: "alice@company.com",
    status: "active",
    role: "admin",
    joinedDate: "2022-11-20",
    avatarSeed: "Alice",
    balance: 8500.5,
  },
  {
    id: "3",
    name: "Bob Johnson",
    email: "bob.j@provider.net",
    status: "suspended",
    role: "user",
    joinedDate: "2023-03-10",
    avatarSeed: "Bob",
    balance: 120.0,
  },
  {
    id: "4",
    name: "Emma Wilson",
    email: "emma.w@studio.io",
    status: "pending",
    role: "user",
    joinedDate: "2023-10-05",
    avatarSeed: "Emma",
    balance: 0.0,
  },
  {
    id: "5",
    name: "Michael Brown",
    email: "m.brown@corp.org",
    status: "active",
    role: "user",
    joinedDate: "2023-06-12",
    avatarSeed: "Michael",
    balance: 45200.0,
  },
  {
    id: "6",
    name: "Sarah Connor",
    email: "sarah@skynet.com",
    status: "active",
    role: "user",
    joinedDate: "2023-08-29",
    avatarSeed: "Sarah",
    balance: 9850.75,
  },
];

const generateMockTransactions = (): AdminTransaction[] => [
  {
    id: "TX-1001",
    userId: "1",
    userName: "John Doe",
    amount: 150.0,
    type: "payment",
    flow: "out",
    status: "success",
    date: "2023-10-25T10:30:00",
  },
  {
    id: "TX-1002",
    userId: "3",
    userName: "Bob Johnson",
    amount: 49.99,
    type: "payment",
    flow: "out",
    status: "failed",
    date: "2023-10-24T14:15:00",
  },
  {
    id: "TX-1003",
    userId: "5",
    userName: "Michael Brown",
    amount: 2500.0,
    type: "transfer",
    flow: "out",
    status: "pending",
    date: "2023-10-24T09:00:00",
  },
  {
    id: "TX-1004",
    userId: "2",
    userName: "Alice Smith",
    amount: 12.5,
    type: "refund",
    flow: "in",
    status: "success",
    date: "2023-10-23T16:45:00",
  },
  {
    id: "TX-1005",
    userId: "6",
    userName: "Sarah Connor",
    amount: 99.0,
    type: "payment",
    flow: "out",
    status: "success",
    date: "2023-10-23T11:20:00",
  },
  {
    id: "TX-1006",
    userId: "1",
    userName: "John Doe",
    amount: 500.0,
    type: "transfer",
    flow: "in",
    status: "success",
    date: "2023-10-22T13:10:00",
  },
];

const StatusBadge = ({ status }: { status: string }) => {
  const styles: any = {
    active:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    pending:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    success:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[status] || "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
};

const AdminDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes("/admin/users")) return "users";
    if (path.includes("/admin/transactions")) return "transactions";
    if (path.includes("/admin/wallet-funding")) return "funds";
    if (path.includes("/admin/audit")) return "audit";
    if (path.includes("/admin/reconciliation")) return "settings";
    return "overview";
  };

  const activeTab = getActiveTab();

  const [users, setUsers] = useState<UserData[]>(generateMockUsers());
  const [transactions, setTransactions] = useState<AdminTransaction[]>(
    generateMockTransactions(),
  );
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>(
    generateMockAuditLogs(),
  );

  // API Call Preparation (Commented out for production use later)
  /*
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch Users
                // const usersRes = await fetch('/admin/users');
                // if(usersRes.ok) setUsers(await usersRes.json());

                // Fetch Transactions
                // const txRes = await fetch('/admin/transactions');
                // if(txRes.ok) setTransactions(await txRes.json());

                // Fetch Audit Logs
                // const auditRes = await fetch('/admin/audit-logs');
                // if(auditRes.ok) setAuditLogs(await auditRes.json());
            } catch (error) {
                console.error("Failed to load dashboard data", error);
            }
        };
        fetchDashboardData();
    }, []);
    */
  const [auditFilter, setAuditFilter] = useState<AdminAuditLog["type"] | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting State
  const [userSort, setUserSort] = useState<{
    key: keyof UserData;
    order: "asc" | "desc";
  }>({ key: "joinedDate", order: "desc" });
  const [txSort, setTxSort] = useState<{
    key: keyof AdminTransaction;
    order: "asc" | "desc";
  }>({ key: "date", order: "desc" });

  const filteredAuditLogs =
    auditFilter === "all"
      ? auditLogs
      : auditLogs.filter((log) => log.type === auditFilter);

  // Sorting Logic
  const sortedUsers = [...users]
    .sort((a, b) => {
      const valA = a[userSort.key];
      const valB = b[userSort.key];
      if (valA < valB) return userSort.order === "asc" ? -1 : 1;
      if (valA > valB) return userSort.order === "asc" ? 1 : -1;
      return 0;
    })
    .filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const sortedTransactions = [...transactions]
    .sort((a, b) => {
      const valA = a[txSort.key];
      const valB = b[txSort.key];
      if (valA < valB) return txSort.order === "asc" ? -1 : 1;
      if (valA > valB) return txSort.order === "asc" ? 1 : -1;
      return 0;
    })
    .filter(
      (t) =>
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.userName.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  // Funds Management State
  const [fundsTab, setFundsTab] = useState<"single" | "bulk">("single");
  const [selectedUserForCredit, setSelectedUserForCredit] =
    useState<string>("");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedUsersForBulk, setSelectedUsersForBulk] = useState<string[]>(
    [],
  );
  const [isProcessingFunds, setIsProcessingFunds] = useState(false);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // User Modals
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isViewUserModalOpen, setIsViewUserModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  // Reconciliation State
  const [reconActiveTab, setReconActiveTab] = useState<
    "overview" | "users" | "reports" | "setup"
  >("overview");
  const [reconUserSort, setReconUserSort] = useState<{
    key: "name" | "discrepancy" | "ledgerBalance" | "actualBalance";
    order: "asc" | "desc";
  }>({ key: "name", order: "asc" });

  // Mock User Reconciliations
  const mockUserReconciliations = useMemo(() => {
    return users.map((u) => {
      if (u.name === "Michael Brown") {
        return {
          ...u,
          ledgerBalance: u.balance,
          actualBalance: u.balance + 1500,
          discrepancy: 1500,
          note: "Reviewed external statement, discrepancy due to timing difference",
        };
      }
      const hasDiscrepancy = Math.random() > 0.8;
      const discrepancy = hasDiscrepancy ? Math.random() * 100 - 50 : 0;
      return {
        ...u,
        ledgerBalance: u.balance,
        actualBalance: u.balance + discrepancy,
        discrepancy: discrepancy,
        note: "",
      };
    });
  }, [users]);

  const sortedUserReconciliations = [...mockUserReconciliations]
    .filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      const valA = a[reconUserSort.key];
      const valB = b[reconUserSort.key];
      if (valA < valB) return reconUserSort.order === "asc" ? -1 : 1;
      if (valA > valB) return reconUserSort.order === "asc" ? 1 : -1;
      return 0;
    });

  const [viewedUser, setViewedUser] = useState<UserData | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<UserData>>({});
  const [selectedReconUser, setSelectedReconUser] = useState<any | null>(null);
  const accountReportQueryRef = useRef<HTMLInputElement | null>(null);

  const userDetailStats = useMemo(() => {
    if (!viewedUser) {
      return { vaultsLinked: "—", totalWallets: "—" };
    }

    const seed = Number.parseInt(viewedUser.id.replace(/\D/g, ""), 10) || 0;
    return {
      vaultsLinked: (seed % 3) + 1,
      totalWallets: (seed % 4) + 1,
    };
  }, [viewedUser?.id]);

  const handleLogout = async () => {
    await authService.logout();
    showToast("success", "Logged out successfully");
  };

  const handleConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const handleDeleteTransaction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleConfirm("Delete Transaction?", "Cannot be undone.", () => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setConfirmModal(null);
      showToast("success", "Transaction deleted");
    });
  };

  const handleSingleCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCredit || !creditAmount) return;
    setIsProcessingFunds(true);
    setTimeout(() => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForCredit
            ? { ...u, balance: u.balance + Number(creditAmount) }
            : u,
        ),
      );
      setIsProcessingFunds(false);
      setCreditAmount("");
      showToast("success", "Funded successfully");
    }, 1000);
  };

  const handleBulkCredit = () => {
    if (selectedUsersForBulk.length === 0 || !creditAmount) return;
    setIsProcessingFunds(true);
    setTimeout(() => {
      setUsers((prev) =>
        prev.map((u) =>
          selectedUsersForBulk.includes(u.id)
            ? { ...u, balance: u.balance + Number(creditAmount) }
            : u,
        ),
      );
      setIsProcessingFunds(false);
      setCreditAmount("");
      showToast("success", "Bulk funded successfully");
    }, 1000);
  };

  const toggleUserSelection = (id: string) =>
    setSelectedUsersForBulk((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleAllUsers = () =>
    setSelectedUsersForBulk(
      selectedUsersForBulk.length === users.length
        ? []
        : users.map((u) => u.id),
    );

  const handleViewUserClick = (u: UserData) => {
    setViewedUser(u);
    setIsViewUserModalOpen(true);
  };

  const sanitizeCsvField = (value: string | number | null | undefined) => {
    const raw = String(value ?? "")
      .replace(/\r?\n/g, " ")
      .replace(/"/g, '""');
    const escaped =
      raw.startsWith("=") ||
      raw.startsWith("+") ||
      raw.startsWith("-") ||
      raw.startsWith("@")
        ? `'${raw}`
        : raw;
    return `"${escaped.replace(/,/g, ";")}"`;
  };

  const handleDownloadStatement = (user: UserData) => {
    const userTxs = transactions.filter((t) => t.userId === user.id);

    if (userTxs.length === 0) {
      showToast("info", `No transactions found for ${user.name}`);
      return;
    }

    const headers = ["Date", "Type", "Flow", "Amount", "Status"];
    const rows = userTxs.map((t) => [
      new Date(t.date).toLocaleString(),
      t.type,
      t.flow,
      t.amount.toString(),
      t.status,
    ]);

    const csvContent = [
      headers.map(sanitizeCsvField).join(","),
      ...rows.map((row) => row.map(sanitizeCsvField).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeUserName =
      user.name
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "") || "user";
    link.setAttribute(
      "download",
      `statement_${safeUserName}_${Date.now()}.csv`,
    );
    link.setAttribute("href", url);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("success", "Statement downloaded successfully");
  };
  const handleSortUsers = (key: keyof UserData) =>
    setUserSort((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  const handleSortTransactions = (key: keyof AdminTransaction) =>
    setTxSort((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* --- OVERVIEW TAB --- */}
      {activeTab === "overview" && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                label: "Total Users",
                value: users.length,
                icon: Users,
                color: "text-blue-500",
                bg: "bg-blue-100 dark:bg-blue-900/20",
                trend: "+12.5%",
              },
              {
                label: "Total Volume",
                value: `$${transactions.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}`,
                icon: ArrowUpRight,
                color: "text-green-500",
                bg: "bg-green-100 dark:bg-green-900/20",
                trend: "+5.2%",
              },
              {
                label: "System Health",
                value: "99.9%",
                icon: Activity,
                color: "text-indigo-500",
                bg: "bg-indigo-100 dark:bg-indigo-900/20",
                trend: "Stable",
              },
              {
                label: "Pending KYC",
                value: users.filter((u) => u.status === "pending").length,
                icon: Shield,
                color: "text-orange-500",
                bg: "bg-orange-100 dark:bg-orange-900/20",
                trend: "Needs Action",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <div
                    className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}
                  >
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-lg ${stat.trend.includes("+") ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {stat.trend}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  {stat.label}
                </p>
                <h3 className="text-3xl font-black mt-1 tracking-tight">
                  {stat.value}
                </h3>
              </div>
            ))}
          </div>

          {/* Quick Access & Align Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Quick Actions Card */}
            <div className="lg:col-span-2 bg-slate-900 dark:bg-slate-950 rounded-[2rem] p-8 text-white relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-2">
                  Core Financial Operations
                </h3>
                <p className="text-slate-400 text-sm mb-10 max-w-md">
                  Access critical system modules to maintain platform integrity
                  and monitor real-time transaction flows.
                </p>

                <div className="flex flex-row items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => navigate("/admin/reconciliation")}
                    className="shrink-0 px-6 py-4 bg-primary hover:bg-primary-light text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/30 active:scale-95 whitespace-nowrap"
                  >
                    <Activity className="w-5 h-5 shrink-0" /> System
                    Reconciliation
                  </button>
                  <button
                    onClick={() => navigate("/admin/transactions")}
                    className="shrink-0 px-6 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all backdrop-blur-md active:scale-95 whitespace-nowrap"
                  >
                    <Globe className="w-5 h-5 shrink-0" /> Global Transactions
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Summary Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <HistoryIcon className="w-5 h-5 text-primary" />
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-xs">
                    Recent Admin Activity
                  </h4>
                </div>
                <div className="space-y-4">
                  {auditLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate line-clamp-1">
                          {log.action}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {log.adminName} •{" "}
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => navigate("/admin/audit")}
                className="mt-8 text-xs font-black text-primary hover:underline flex items-center gap-2"
              >
                VIEW ALL LOGS &rarr;
              </button>
            </div>
          </div>

          {/* Detailed Insights Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-lg font-black tracking-tight">
                  User Growth
                </h4>
                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-500">
                  LAST 30 DAYS
                </div>
              </div>
              <div className="h-40 flex items-end gap-2 px-2">
                {[40, 25, 60, 45, 80, 55, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-t-xl relative group overflow-hidden"
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-primary group-hover:bg-primary-light transition-all duration-500 rounded-t-xl"
                      style={{ height: `${h}%` }}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 px-1">
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
                <span>SUN</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-lg font-black tracking-tight">
                  System Distribution
                </h4>
                <Settings className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-6 flex-1 flex flex-col justify-center">
                {[
                  {
                    label: "Active Sessions",
                    val: 124,
                    max: 200,
                    color: "bg-blue-500",
                  },
                  {
                    label: "Transaction Rate",
                    val: 45,
                    max: 100,
                    color: "bg-green-500",
                  },
                  {
                    label: "API Latency",
                    val: 85,
                    max: 100,
                    color: "bg-purple-500",
                  },
                ].map((bar, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500 uppercase tracking-widest">
                        {bar.label}
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        {bar.val}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar.color} rounded-full`}
                        style={{ width: `${(bar.val / bar.max) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* System Controls & Logs Detail */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <HistoryIcon className="w-5 h-5 text-slate-500" />
                  </div>
                  <h4 className="font-black tracking-tight">
                    Real-time System Logs
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Live Streaming
                  </span>
                </div>
              </div>
              <div className="p-0 max-h-80 overflow-y-auto no-scrollbar font-mono">
                {[
                  {
                    t: "14:22:01",
                    l: "INFO",
                    m: "Batch settlement job started successfully",
                    c: "text-blue-500",
                  },
                  { t: "14:21:45", l: "WARN", m: "High latency detected" },
                  { t: "14:20:12", l: "CRIT", m: "KYC WebHook timeout" },
                  { t: "14:19:55", l: "INFO", m: "New user joined: alex_fin" },
                  {
                    t: "14:18:30",
                    l: "INFO",
                    m: "Config updated: system_mode=PROD",
                  },
                  { t: "14:17:10", l: "INFO", m: "Cache cleared for users:12" },
                ].map((log, i) => (
                  <div
                    key={i}
                    className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                      {log.t}
                    </span>
                    <span
                      className={`text-[10px] font-black shrink-0 px-2 py-0.5 rounded ${log.l === "CRIT" ? "bg-red-100 text-red-600" : log.l === "WARN" ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"}`}
                    >
                      {log.l}
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                      {log.m}
                    </p>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 text-center">
                <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
                  Download Audit Log (.csv)
                </button>
              </div>
            </div>

            <div className="bg-slate-900 dark:bg-black rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-white font-black mb-6 tracking-tight flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" /> Quick Toggles
                </h4>
                <div className="space-y-6">
                  {[
                    { label: "Maintenance Mode", active: false },
                    { label: "Auto-KYC Verification", active: true },
                    { label: "Freeze Global Transfers", active: false },
                    { label: "Enable Sandbox Data", active: true },
                  ].map((toggle, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">
                        {toggle.label}
                      </span>
                      <button
                        className={`w-10 h-5 rounded-full relative transition-colors ${toggle.active ? "bg-primary" : "bg-slate-700"}`}
                      >
                        <div
                          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${toggle.active ? "right-1" : "left-1"}`}
                        ></div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-8 w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 text-xs tracking-widest uppercase">
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === "users" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-[200px]">
              <h2 className="text-lg font-bold">User Management</h2>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
            </div>
            <button className="bg-primary px-4 py-2 text-white font-bold rounded-lg text-sm flex items-center gap-2 hover:bg-primary-light transition-colors">
              <Users className="w-4 h-4" /> New User
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                <tr>
                  {["name", "status", "role", "joinedDate"].map((key) => (
                    <th
                      key={key}
                      className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                      onClick={() => handleSortUsers(key as any)}
                    >
                      <div className="flex items-center gap-2">
                        {key.toUpperCase()}
                        {userSort.key === key &&
                          (userSort.order === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    onClick={() => handleViewUserClick(user)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`}
                          className="w-9 h-9 rounded-full bg-slate-100"
                        />
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                            {user.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 capitalize">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {user.joinedDate}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditUserModalOpen(true);
                            setCurrentUser(user);
                            setEditFormData(user);
                          }}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TRANSACTIONS TAB --- */}
      {activeTab === "transactions" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-[200px]">
              <h2 className="text-lg font-bold">Transaction History</h2>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ID or User..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                <tr>
                  {["id", "userName", "type", "amount", "status", "date"].map(
                    (key) => (
                      <th
                        key={key}
                        className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                        onClick={() => handleSortTransactions(key as any)}
                      >
                        <div className="flex items-center gap-2">
                          {key === "userName" ? "USER" : key.toUpperCase()}
                          {txSort.key === key &&
                            (txSort.order === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </div>
                      </th>
                    ),
                  )}
                  <th className="px-6 py-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {tx.id}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {tx.userName}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-bold capitalize text-slate-600 dark:text-slate-300">
                        {tx.type}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 font-bold ${tx.flow === "in" ? "text-green-500" : "text-slate-900 dark:text-white"}`}
                    >
                      {tx.flow === "in" ? "+" : "-"}${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => handleDeleteTransaction(tx.id, e)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- FUNDS MANAGEMENT TAB --- */}
      {activeTab === "funds" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            {["single", "bulk"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFundsTab(tab as "single" | "bulk")}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${fundsTab === tab ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                {tab === "single" ? "Single Credit" : "Bulk Distribution"}
              </button>
            ))}
          </div>

          {fundsTab === "single" ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 max-w-2xl">
              <h3 className="text-xl font-bold mb-6">Credit User Account</h3>
              <form onSubmit={handleSingleCredit} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Select User
                  </label>
                  <CustomSelect
                    value={selectedUserForCredit}
                    onChange={(value) => setSelectedUserForCredit(value)}
                    options={[
                      { value: "", label: "Select a user..." },
                      ...users.map((u) => ({
                        value: u.id,
                        label: `${u.name} (${u.email})`,
                      })),
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Amount
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={
                    isProcessingFunds || !selectedUserForCredit || !creditAmount
                  }
                  className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessingFunds ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Credit Funds"
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xl font-bold">Bulk Distribution</h3>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm font-bold w-32 focus:ring-2 focus:ring-primary outline-none"
                      placeholder="Amount"
                    />
                  </div>
                  <button
                    onClick={handleBulkCredit}
                    disabled={
                      isProcessingFunds ||
                      selectedUsersForBulk.length === 0 ||
                      !creditAmount
                    }
                    className="bg-primary px-4 py-2 text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
                  >
                    {isProcessingFunds
                      ? "Processing..."
                      : `Distribute to ${selectedUsersForBulk.length}`}
                  </button>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4 w-12">
                      <button
                        onClick={toggleAllUsers}
                        className="text-slate-400 hover:text-primary"
                      >
                        {selectedUsersForBulk.length === users.length ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedUsersForBulk.includes(user.id) ? "bg-primary/5" : ""}`}
                      onClick={() => toggleUserSelection(user.id)}
                    >
                      <td className="px-6 py-4">
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center ${selectedUsersForBulk.includes(user.id) ? "bg-primary border-primary text-white" : "border-slate-300 dark:border-slate-600"}`}
                        >
                          {selectedUsersForBulk.includes(user.id) && (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold">{user.name}</td>
                      <td className="px-6 py-4 text-slate-500">{user.email}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-6 py-4 font-mono">
                        ${user.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- AUDIT LOGS TAB --- */}
      {activeTab === "audit" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold">Administrative Audit Logs</h2>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Filter className="w-4 h-4 text-slate-500" />
                </div>
                <div className="w-40">
                  <CustomSelect
                    value={auditFilter}
                    onChange={(value) => setAuditFilter(value as any)}
                    options={[
                      { value: "all", label: "All Types" },
                      { value: "user", label: "User Actions" },
                      { value: "funds", label: "Funds Management" },
                      { value: "kyc", label: "KYC Reviews" },
                      { value: "system", label: "System Updates" },
                    ]}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <Download className="w-4 h-4" /> Export Logs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                <tr>
                  <th className="px-6 py-4">ACTION</th>
                  <th className="px-6 py-4">TARGET ENTITY</th>
                  <th className="px-6 py-4">PERFORMED BY</th>
                  <th className="px-6 py-4">TIMESTAMP</th>
                  <th className="px-6 py-4 text-right">TYPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAuditLogs.length > 0 ? (
                  filteredAuditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <HistoryIcon className="w-3.5 h-3.5 text-slate-400" />
                          {log.action}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {log.target}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-3.5 h-3.5 text-primary" />
                          <span className="font-semibold">{log.adminName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                            log.type === "user"
                              ? "bg-blue-100 text-blue-700"
                              : log.type === "funds"
                                ? "bg-green-100 text-green-700"
                                : log.type === "kyc"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {log.type}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No logs found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- RECONCILIATION TAB --- */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          {/* Secondary Navigation */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-fit overflow-x-auto shadow-inner">
            <button
              onClick={() => setReconActiveTab("overview")}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${reconActiveTab === "overview" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setReconActiveTab("users")}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${reconActiveTab === "users" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              User Discrepancies
            </button>
            <button
              onClick={() => setReconActiveTab("reports")}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${reconActiveTab === "reports" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              Reports
            </button>
            <button
              onClick={() => setReconActiveTab("setup")}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${reconActiveTab === "setup" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              Setup & Jobs
            </button>
          </div>

          {reconActiveTab === "overview" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold">Ledger vs. Provider</h3>
                      <p className="text-slate-500 text-sm">
                        System balances versus payment gateway accounts
                      </p>
                    </div>
                    <button className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
                      <Activity className="w-4 h-4" /> Run Reconciliation
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center">
                          <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            Paystack Gateway
                          </p>
                          <p className="text-sm text-slate-500">
                            Last synced: 2 minutes ago
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <span className="text-sm font-semibold text-slate-600">
                            Ledger: $450,210.50
                          </span>
                          <span className="text-sm text-slate-300">|</span>
                          <span className="text-sm font-semibold text-green-600">
                            Actual: $450,210.50
                          </span>
                        </div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-green-100 text-green-700">
                          MATCHED
                        </span>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border-2 border-red-100 dark:border-red-900/20 bg-red-50/50 dark:bg-red-900/10 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-full flex items-center justify-center">
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            Fidelity Bank Settlement
                          </p>
                          <p className="text-sm text-slate-500">
                            Last synced: 1 hour ago
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <span className="text-sm font-semibold text-slate-600">
                            Ledger: $120,500.00
                          </span>
                          <span className="text-sm text-slate-300">|</span>
                          <span className="text-sm font-semibold text-red-600">
                            Actual: $120,450.00
                          </span>
                        </div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-red-100 text-red-700">
                          DISCREPANCY ($-50.00)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                  <h3 className="text-lg font-bold mb-2">
                    Reconciliation Alerts
                  </h3>
                  <p className="text-slate-500 text-sm mb-6">
                    Review flagged items needing attention.
                  </p>

                  <div className="flex-1 space-y-4">
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                            Missing Settlement
                          </p>
                          <p className="text-xs text-slate-500 mb-3">
                            TX-8923 ($50.00) from Fidelity Bank is missing in
                            external records.
                          </p>
                          <button className="text-xs font-bold text-primary hover:text-primary-light transition-colors">
                            Review Details &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <HistoryIcon className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                            Stale Pending Funds
                          </p>
                          <p className="text-xs text-slate-500 mb-3">
                            12 incoming transfers have been pending for &gt; 48
                            hours.
                          </p>
                          <button className="text-xs font-bold text-primary hover:text-primary-light transition-colors">
                            Investigate &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">Ledger vs. Users</h3>
                    <p className="text-slate-500 text-sm">
                      System total ledger balance versus sum of all user account
                      balances
                    </p>
                  </div>
                  <button className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                    <Activity className="w-4 h-4" /> Run Ledger Audit
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-sm text-slate-500 mb-1">
                      Total System Ledger
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      $1,250,500.00
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-sm text-slate-500 mb-1">
                      Sum of User Balances
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      $1,250,500.00
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border-2 border-green-100 dark:border-green-900/20 bg-green-50/50 dark:bg-green-900/10 flex flex-col justify-center items-center">
                    <p className="text-sm font-bold text-green-600 mb-1 uppercase tracking-wider">
                      Status
                    </p>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      PERFECT MATCH
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-lg font-bold">Unresolved Transactions</h3>
                  <button className="text-sm font-bold text-primary hover:text-primary-light">
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                      <tr>
                        <th className="px-6 py-4">TX ID</th>
                        <th className="px-6 py-4">GATEWAY</th>
                        <th className="px-6 py-4">ISSUE</th>
                        <th className="px-6 py-4">AMOUNT</th>
                        <th className="px-6 py-4 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">TX-8923</td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          Fidelity Bank
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-red-500 bg-red-50 px-2 py-1 rounded text-xs font-semibold">
                            Not Found Externally
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold">$50.00</td>
                        <td className="px-6 py-4 text-right">
                          <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                            Resolve
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">TX-9104</td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          Paystack
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-yellow-600 bg-yellow-50 px-2 py-1 rounded text-xs font-semibold">
                            Amount Mismatch
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold">$250.00</td>
                        <td className="px-6 py-4 text-right">
                          <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                            Resolve
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reconActiveTab === "users" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 md:flex items-center justify-between gap-4 space-y-4 md:space-y-0">
                <div>
                  <h3 className="text-lg font-bold">
                    User Account Reconciliations
                  </h3>
                  <p className="text-slate-500 text-sm">
                    Discrepancy reports between internal ledger and individual
                    users
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full md:w-64 pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <button className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                    <tr>
                      <th
                        className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                        onClick={() =>
                          setReconUserSort({
                            key: "name",
                            order:
                              reconUserSort.key === "name" &&
                              reconUserSort.order === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        User{" "}
                        <ChevronDown
                          className={`inline w-3 h-3 transition-transform ${reconUserSort.key === "name" && reconUserSort.order === "desc" ? "rotate-180" : ""}`}
                        />
                      </th>
                      <th
                        className="px-6 py-4 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                        onClick={() =>
                          setReconUserSort({
                            key: "ledgerBalance",
                            order:
                              reconUserSort.key === "ledgerBalance" &&
                              reconUserSort.order === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Ledger Balance{" "}
                        <ChevronDown
                          className={`inline w-3 h-3 transition-transform ${reconUserSort.key === "ledgerBalance" && reconUserSort.order === "desc" ? "rotate-180" : ""}`}
                        />
                      </th>
                      <th
                        className="px-6 py-4 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                        onClick={() =>
                          setReconUserSort({
                            key: "actualBalance",
                            order:
                              reconUserSort.key === "actualBalance" &&
                              reconUserSort.order === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Actual Balance{" "}
                        <ChevronDown
                          className={`inline w-3 h-3 transition-transform ${reconUserSort.key === "actualBalance" && reconUserSort.order === "desc" ? "rotate-180" : ""}`}
                        />
                      </th>
                      <th
                        className="px-6 py-4 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                        onClick={() =>
                          setReconUserSort({
                            key: "discrepancy",
                            order:
                              reconUserSort.key === "discrepancy" &&
                              reconUserSort.order === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Discrepancy{" "}
                        <ChevronDown
                          className={`inline w-3 h-3 transition-transform ${reconUserSort.key === "discrepancy" && reconUserSort.order === "desc" ? "rotate-180" : ""}`}
                        />
                      </th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedUserReconciliations.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          <div>{user.name}</div>
                          <div className="font-mono text-[10px] text-slate-400 font-normal">
                            {user.id.substring(0, 8)}...
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-600 dark:text-slate-300">
                          $
                          {user.ledgerBalance.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-600 dark:text-slate-300">
                          $
                          {user.actualBalance.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-bold ${user.discrepancy === 0 ? "text-slate-400" : user.discrepancy > 0 ? "text-green-600" : "text-red-500"}`}
                        >
                          {user.discrepancy === 0
                            ? "-"
                            : `${user.discrepancy > 0 ? "+" : ""}$${user.discrepancy.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {user.discrepancy === 0 ? (
                            <span className="inline-block px-2 py-1 rounded text-[10px] font-bold bg-green-100 text-green-700">
                              MATCHED
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              FLAGGED
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReconUser(user);
                            }}
                            className="p-2 text-slate-400 hover:text-primary transition-colors tooltip-trigger relative group"
                          >
                            <Activity className="w-4 h-4" />
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                              Audit User
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reconActiveTab === "reports" && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in mb-6">
              <h3 className="text-xl font-bold mb-6">Reconciliation Exports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Download className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                    Global Reconciliation Report
                  </h4>
                  <p className="text-sm text-slate-500 mb-4">
                    Complete audit trail of all ledger vs provider matchings and
                    discrepancies.
                  </p>
                  <div className="flex items-center text-xs font-bold text-primary">
                    Download CSV &rarr;
                  </div>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-primary/50 transition-colors cursor-pointer group">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                    User Discrepancy Report
                  </h4>
                  <p className="text-sm text-slate-500 mb-4">
                    Export list of all accounts currently flagged with ledger
                    mismatches.
                  </p>
                  <div className="flex items-center text-xs font-bold text-blue-600">
                    Download CSV &rarr;
                  </div>
                </div>
              </div>

              <h4 className="font-bold text-lg mb-4">
                Generate Account specific report
              </h4>
              <div className="flex flex-col md:flex-row gap-4 max-w-2xl">
                <input
                  ref={accountReportQueryRef}
                  type="text"
                  placeholder="Enter User Email or ID..."
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white"
                />
                <button
                  onClick={() => {
                    const query = (accountReportQueryRef.current?.value || "")
                      .toLowerCase()
                      .trim();
                    if (!query)
                      return showToast(
                        "error",
                        "Please enter a user ID or email",
                      );

                    const matchedUser = users.find(
                      (u) =>
                        u.email.toLowerCase() === query ||
                        u.id.toLowerCase() === query,
                    );

                    if (!matchedUser) {
                      showToast("error", `No user found for "${query}"`);
                      return;
                    }

                    handleDownloadStatement(matchedUser);
                  }}
                  className="px-6 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" /> Find & Export
                </button>
              </div>
            </div>
          )}

          {reconActiveTab === "setup" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xl font-bold mb-2">Job Configuration</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Setup scheduled reconciliation jobs to automatically compare
                  records.
                </p>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Reconciliation Frequency
                    </label>
                    <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer">
                      <option>Hourly</option>
                      <option>Daily at 00:00 UTC</option>
                      <option>Weekly on Sunday</option>
                      <option>Manual Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Tolerance Threshold
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        defaultValue="0.00"
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Discrepancies below this amount will not trigger alerts.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Default Lookback Date Range
                    </label>
                    <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer">
                      <option>Last 24 Hours</option>
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                      <option>All Time</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                <h3 className="text-xl font-bold mb-2">Account Mapping</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Map internal system accounts to external provider endpoints.
                </p>

                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">
                        PS
                      </div>
                      <div>
                        <p className="font-bold text-sm">
                          Paystack Nigerian Naira
                        </p>
                        <p className="text-xs text-slate-500">
                          API Key Configured
                        </p>
                      </div>
                    </div>
                    <button className="text-primary text-sm font-bold">
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs">
                        ST
                      </div>
                      <div>
                        <p className="font-bold text-sm">Stripe USD Sandbox</p>
                        <p className="text-xs text-slate-500">Webhook Active</p>
                      </div>
                    </div>
                    <button className="text-primary text-sm font-bold">
                      Edit
                    </button>
                  </div>
                  <button className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:border-slate-400 transition-colors font-bold text-sm">
                    + Add Gateway Mapping
                  </button>
                </div>
                <button className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors mt-6 shadow-lg shadow-primary/20">
                  Save Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Detail Modal */}
      {selectedReconUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-2xl font-black tracking-tight">
                  Reconciliation Audit
                </h3>
                <p className="text-slate-500 text-sm font-medium">
                  Detailed breakdown for {selectedReconUser.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedReconUser(null)}
                className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Ledger Balance
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    ${selectedReconUser.ledgerBalance.toLocaleString()}
                  </p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Actual Balance
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    ${selectedReconUser.actualBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedReconUser.discrepancy !== 0 && (
                <div className="p-6 bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/20 rounded-[1.5rem] flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-red-700 dark:text-red-400 font-black text-sm">
                      Discrepancy Found: $
                      {selectedReconUser.discrepancy > 0 ? "+" : ""}
                      {selectedReconUser.discrepancy.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-red-600/70 dark:text-red-400/70 text-xs font-medium">
                      The system has flagged this account. Internal ledger
                      records do not match the real-time account balance.
                    </p>
                    {(selectedReconUser as any).note && (
                      <p className="mt-2 text-sm text-red-800 dark:text-red-300 font-bold bg-white/50 dark:bg-black/20 px-3 py-2 rounded-lg">
                        Note: {(selectedReconUser as any).note}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">
                  Potential Causes
                </h4>
                <div className="space-y-3">
                  {[
                    { label: "Unsettled batch transaction", risk: "High" },
                    {
                      label: "Rounding error in currency conversion",
                      risk: "Low",
                    },
                    { label: "Duplicate ledger entry", risk: "Medium" },
                  ].map((cause, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-sm font-bold">{cause.label}</span>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-lg ${cause.risk === "High" ? "bg-red-100 text-red-600" : cause.risk === "Medium" ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"}`}
                      >
                        {cause.risk} RISK
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
              <button
                onClick={() => setSelectedReconUser(null)}
                className="px-6 py-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button className="px-8 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95">
                Trigger Fix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODAL --- */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">
                {confirmModal.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                {confirmModal.message}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                >
                  Yes, Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- USER DETAILS MODAL --- */}
      {isViewUserModalOpen && viewedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${viewedUser.avatarSeed}`}
                  className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200"
                />
                <div>
                  <h3 className="text-2xl font-black tracking-tight">
                    {viewedUser.name}
                  </h3>
                  <p className="text-slate-500 text-sm font-medium">
                    {viewedUser.email} • ID: {viewedUser.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsViewUserModalOpen(false)}
                className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 flex-1 w-full">
              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-1 truncate">
                    Balance
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white truncate">
                    $
                    {viewedUser.balance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-1 truncate">
                    Vaults Linked
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {userDetailStats.vaultsLinked}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-1 truncate">
                    Total Wallets
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {userDetailStats.totalWallets}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-1 truncate">
                    Status
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={viewedUser.status} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> Account Details
                  </h4>
                  <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                      <span className="text-xs text-slate-500 font-bold">
                        Role
                      </span>
                      <span className="text-sm font-semibold capitalize">
                        {viewedUser.role}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                      <span className="text-xs text-slate-500 font-bold">
                        Joined Date
                      </span>
                      <span className="text-sm font-semibold">
                        {viewedUser.joinedDate}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                      <span className="text-xs text-slate-500 font-bold">
                        KYC Status
                      </span>
                      <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-lg">
                        VERIFIED
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                      <span className="text-xs text-slate-500 font-bold">
                        Trading Tier
                      </span>
                      <span className="text-sm font-semibold">Tier 2</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                      <span className="text-xs text-slate-500 font-bold">
                        2FA Status
                      </span>
                      <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Enabled
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-slate-500 font-bold">
                        Last Login
                      </span>
                      <span className="text-sm font-semibold">
                        Today, 10:42 AM
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4" /> Recent Activity
                  </h4>
                  <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4">
                    <div className="space-y-4">
                      {transactions
                        .filter((t) => t.userId === viewedUser.id)
                        .slice(0, 4)
                        .map((tx, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-xl ${tx.flow === "in" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-600"}`}
                              >
                                <Activity className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                                  {tx.type}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {new Date(tx.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-sm font-black ${tx.flow === "in" ? "text-green-500" : "text-slate-900 dark:text-white"}`}
                            >
                              {tx.flow === "in" ? "+" : "-"}$
                              {tx.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      {transactions.filter((t) => t.userId === viewedUser.id)
                        .length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-4">
                          No recent activity found.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => handleDownloadStatement(viewedUser)}
                      className="text-xs font-bold text-primary hover:text-primary-light transition-colors"
                    >
                      Download Statement &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardScreen;
