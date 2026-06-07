import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import { socketRegistry } from "./socket.registry";
import jwt from "jsonwebtoken";

export function initializeSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ─── Auth middleware ───────────────────────────────────────────────────
  // Verify JWT before allowing connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      logger.warn("WebSocket connection rejected — no token", {
        socketId: socket.id,
      });
      return next(new Error("UNAUTHORIZED"));
    }

    try {
      const payload = jwt.verify(token, config.jwt.accessSecret) as any;
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      next();
    } catch (err) {
      logger.warn("WebSocket connection rejected — invalid token", {
        socketId: socket.id,
      });
      next(new Error("UNAUTHORIZED"));
    }
  });

  // ─── Connection handler ────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = socket.data.userId;

    // Register the connection
    socketRegistry.register(userId, socket);

    // Send confirmation to client
    socket.emit("connected", {
      message: "WebSocket connected successfully",
      userId,
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      socketRegistry.unregister(userId, socket.id);
      logger.info("WebSocket client disconnected", {
        userId,
        socketId: socket.id,
        reason,
      });
    });

    // Handle errors
    socket.on("error", (err) => {
      logger.error("WebSocket error", {
        userId,
        socketId: socket.id,
        error: err.message,
      });
    });
  });

  logger.info("✅ WebSocket server initialized");
  return io;
}
