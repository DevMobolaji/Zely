import React, { useState, useMemo, useEffect } from "react";
import { useNotifications } from "@/context/notificationCOntext";
import {
  Bell,
  Search,
  Trash2,
  CheckCheck,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Info,
  Inbox,
  X,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";

type NotificationTab = "all" | "transactions" | "security" | "info";

const NotificationsScreen: React.FC = () => {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Reset pagination when tab or search query changes
  useEffect(() => {
    setVisibleCount(10);
  }, [activeTab, searchQuery]);

  // Handle single read with toast
  const handleRead = (id: string) => {
    markAsRead(id);
  };

  // Filter and search
  const filteredNotifications = useMemo(() => {
    return notifications.filter((note: any) => {
      // Apply route/tab filter
      let tabMatch = true;
      if (activeTab === "transactions") {
        tabMatch = note.type === "credit" || note.type === "debit";
      } else if (activeTab === "security") {
        tabMatch = note.type === "security";
      } else if (activeTab === "info") {
        tabMatch = note.type === "info";
      }

      // Apply search query filter
      const matchesQuery =
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.message.toLowerCase().includes(searchQuery.toLowerCase());

      return tabMatch && matchesQuery;
    });
  }, [notifications, activeTab, searchQuery]);

  const getIcon = (type: string) => {
    switch (type) {
      case "credit":
        return {
          bg: "bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400",
          icon: <ArrowDownLeft className="w-5 h-5" />,
        };
      case "debit":
        return {
          bg: "bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
          icon: <ArrowUpRight className="w-5 h-5" />,
        };
      case "security":
        return {
          bg: "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400",
          icon: <Shield className="w-5 h-5" />,
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
          icon: <Info className="w-5 h-5" />,
        };
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    showToast("success", "All notifications marked as read");
  };

  const handleDelete = async (id: string, title: string) => {
    await deleteNotification(id);
    showToast("success", `Notification deleted`);
  };

  const handleClearAll = () => {
    setIsClearModalOpen(true);
  };

  const confirmClearAll = () => {
    clearAll();
    setIsClearModalOpen(false);
    showToast("success", "All notifications cleared");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Action Bar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Notifications Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            View, search, and manage your recent activity notifications and
            system alerts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleMarkAllRead}
            disabled={notifications.length === 0}
            className="flex-1 sm:flex-none py-2.5 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-800 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
          <button
            onClick={handleClearAll}
            disabled={notifications.length === 0}
            className="flex-1 sm:flex-none py-2.5 px-4 bg-red-50/50 hover:bg-red-50 dark:bg-red-950/10 dark:hover:bg-red-950/20 disabled:opacity-50 disabled:cursor-not-allowed border border-red-100/50 dark:border-red-900/20 hover:border-red-200 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 transition-all flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Clear all
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch">
        {/* Custom Tab Selector */}
        <div className="flex gap-1 overflow-x-auto p-1 bg-slate-50 dark:bg-slate-950 rounded-xl">
          {(["all", "transactions", "security", "info"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-extrabold capitalize rounded-lg transition-all shrink-0 ${
                activeTab === tab
                  ? "bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm ring-1 ring-slate-100 dark:ring-slate-700/50"
                  : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {tab === "all" ? "All Alerts" : tab}
            </button>
          ))}
        </div>

        {/* Live Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 pl-11 pr-10 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:font-normal placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 rounded-full transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications List Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-850">
        {filteredNotifications.length > 0 ? (
          <>
            {filteredNotifications.slice(0, visibleCount).map((note) => {
              const styleInfo = getIcon(note.type);
              return (
                <div
                  key={note.id}
                  className={`p-5 transition-all duration-300 flex gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-850/20 group relative overflow-hidden ${
                    !note.read
                      ? "bg-primary/[0.02]/ border-l-2 border-l-primary"
                      : "border-l-2 border-l-transparent"
                  }`}
                >
                  {/* Left Icon status */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${styleInfo.bg}`}
                  >
                    {styleInfo.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h3
                        className={`text-sm font-bold text-slate-900 dark:text-white ${!note.read ? "font-extrabold text-primary dark:text-primary-light" : ""}`}
                      >
                        {note.title}
                      </h3>
                      {!note.read && (
                        <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {note.message}
                    </p>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase block mt-2">
                      {note.time}
                    </span>
                  </div>

                  {/* Hover Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 p-1.5 pl-4 rounded-full shadow-sm sm:shadow-none border dark:border-slate-800 sm:border-0">
                    {!note.read && (
                      <button
                        onClick={() => handleRead(note.id)}
                        title="Mark as read"
                        className="p-1 px-2.5 bg-slate-50 border dark:border-slate-800 hover:bg-primary hover:text-white rounded-lg text-[10px] font-extrabold text-slate-600 dark:text-slate-350 transition-all flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(note.id, note.title)}
                      title="Delete notification"
                      className="p-1.5 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/35 dark:hover:text-red-400 rounded-lg text-slate-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredNotifications.length > visibleCount && (
              <div className="p-4 bg-slate-50/40 dark:bg-slate-950/20 text-center flex justify-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:text-primary dark:hover:text-white hover:border-primary/40 dark:hover:border-primary/40 transition-all hover:shadow-sm active:scale-[0.98] flex items-center gap-2"
                >
                  <span>Load More Notifications</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-slate-50/20 dark:bg-slate-900/20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 animate-bounce">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              No notifications found
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchQuery
                ? "No notifications match your current search queries. Try clearing search filters."
                : "You're all caught up! New account events will show up here."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 px-3.5 py-2 bg-white border dark:bg-slate-800 dark:border-slate-700 font-extrabold text-xs text-primary dark:text-white rounded-xl hover:shadow-sm transition-all"
              >
                Clear search filter
              </button>
            )}
          </div>
        )}
      </div>
      {isClearModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsClearModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] w-full max-w-md shadow-2xl p-6 md:p-8 relative overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col items-center text-center gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsClearModalOpen(false)}
              className="absolute right-6 top-6 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-1">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Clear All Notifications?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you absolutely sure you want to permanently delete all
                notifications? This action is irreversible and cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="flex-1 py-3 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearAll}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/10 hover:shadow-red-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsScreen;
