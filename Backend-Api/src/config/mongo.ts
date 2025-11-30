import mongoose from "mongoose";
import "dotenv/config";

require('dotenv').config();

const MONGO_URL = process.env.MONGO_URI as string;

if (!MONGO_URL) {
  throw new Error("MONGO_URI is missing");
}

mongoose.set("strictQuery", false);

let isConnected = false;

export async function mongoConnect(
  maxRetries = 5,
  retryDelay = 3000
): Promise<void> {
  if (isConnected) return;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(MONGO_URL, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
      });

      isConnected = true;
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
      return;
    } catch (err) {
      console.error(
        `MongoDB connection attempt ${attempt} failed:`,
        (err as Error).message
      );

      if (attempt === maxRetries) {
        console.error("All retries failed. Exiting...");
        process.exit(1);
      }

      await wait(retryDelay * attempt); // exponential backoff
    }
  }
}

export async function mongoDisconnect(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log("MongoDB disconnected");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}






