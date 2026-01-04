import mongoose from "mongoose";
import { runOutboxRelay } from "./outbox.relay";
import {config} from "@/config/index";



async function connectMongo() {
  try {
    await mongoose.connect(config.database.mongodb.uri)
    console.log("✅ MongoDB connected");

    // Start your worker after connection confirmed
    runOutboxRelay();
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    // Retry after delay
    setTimeout(connectMongo, 5000);
  }
}

// Listen to connection events for better observability
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Attempting reconnection...");
  connectMongo();
});

// Kick off initial connection
connectMongo();
