import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../utils/api";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace("/api/v1", "") ||
  "http://localhost:3000";

export const useSocket = (
  onBalanceUpdate: (data: BalanceUpdatePayload) => void,
  onNotification: (data: NotificationPayload) => void,
  onReconnect?: () => void, // ← add this
) => {
  const socketRef = useRef<Socket | null>(null);
  const onBalanceUpdateRef = useRef(onBalanceUpdate);
  const onNotificationRef = useRef(onNotification);
  const onReconnectRef = useRef(onReconnect); // ← add this

  useEffect(() => {
    onBalanceUpdateRef.current = onBalanceUpdate;
  }, [onBalanceUpdate]);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    onReconnectRef.current = onReconnect; // ← add this
  }, [onReconnect]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connected", (data) => {
      console.log("WebSocket connected", data);
    });

    socket.on("connect", () => {
      // Reconnected — might have missed events while offline
      onReconnectRef.current?.(); // ← add this
    });

    socket.on("balance:updated", (data: BalanceUpdatePayload) => {
      onBalanceUpdateRef.current(data);
    });

    socket.on("notification:new", (data: NotificationPayload) => {
      onNotificationRef.current(data);
    });

    socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("WebSocket connection error", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef;
};

export interface BalanceUpdatePayload {
  walletId: string;
  walletType: string;
  newBalance: number;
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  transactionId: string;
  occurredAt: string;
}

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  amount: number;
  currency: string;
  occurredAt: string;
}
