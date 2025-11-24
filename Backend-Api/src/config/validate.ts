// src/config/env.ts
import * as dotenv from 'dotenv';
import { cleanEnv, str, port, bool, num } from "envalid";

 // loads .env into process.env

// Load .env file only in non-production environments
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

console.log(process.env.JWT_SECRET); 
function validateEnvVariables(): void {
 cleanEnv(process.env, {
  NODE_ENV: str({ choices: ["development", "staging", "production"], default: "development" }),
  PORT: port({ default: 3000 }),
  

  // Database
  MONGO_URI: str({ desc: "MongoDB connection string", default: 'changeme'}),
  MONGO_USER: str({ default: "" }),
  MONGO_PASSWORD: str({ default: "" }),

  // Authentication
  JWT_SECRET: str({ desc: "Secret key for JWT tokens", default: 'changeme'}),

  // Session
  SESSION_SECRET: str({ desc: "Secret for session encryption", default: 'changeme'}),
  SESSION_NAME: str({ default: "session" }),

  // Optional variables
  DEBUG: bool({ default: false }),
  CACHE_TTL: num({ default: 3600 }), // example numeric env
    });
}


export default validateEnvVariables;