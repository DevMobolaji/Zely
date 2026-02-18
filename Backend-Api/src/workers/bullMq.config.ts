import { config } from "../config";

export const conn = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db1,
  };