import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { transactionService } from "../services/transactionService";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  amount?: number;
  currency?: string;
  read: boolean;
  occurredAt: string;
  time: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: NotificationItem) => void;
  loadMore: () => void;
  hasMore: boolean;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const formatTime = (occurredAt: string) => {
    const date = new Date(occurredAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} mins ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  };

  const fetchNotifications = useCallback(async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const result = await transactionService.getNotifications(pageNum, 20);
      const formatted = result.notifications.map((n: any) => ({
        ...n,
        time: formatTime(n.occurredAt),
      }));

      if (pageNum === 1) {
        setNotifications(formatted);
      } else {
        setNotifications((prev) => [...prev, ...formatted]);
      }

      setUnreadCount(result.unreadCount);
      setHasMore(result.pagination.hasMore);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await transactionService.markOneNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await transactionService.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const addNotification = (notification: NotificationItem) => {
    setNotifications((prev) => {
      const exists = prev.some((n) => n.id === notification.id);
      if (exists) return prev;
      return [notification, ...prev];
    });
    setUnreadCount((prev) => prev + 1);
  };

  const loadMore = () => {
    setPage((prev) => {
      const next = prev + 1;
      fetchNotifications(next);
      return next;
    });
  };

  const deleteNotification = async (id: string) => {
    try {
      await transactionService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      // Update unread count if deleted notification was unread
      const wasUnread = notifications.find((n) => n.id === id && !n.read);
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const clearAll = async () => {
    try {
      await transactionService.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        addNotification,
        loadMore,
        hasMore,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  return context;
};
