import Redis from "ioredis";

export const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on("connect", () => {
  console.log(" Redis: Connecting...");
});

redisClient.on("ready", () => {
  console.log(" Redis: Connected and ready to use");
});

redisClient.on("error", (err) => {
  console.error(" Redis connection error:", err);
});
