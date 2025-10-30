import Redis from "ioredis";

export const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD || undefined, 

});

redisClient.on("connect", () => {
  
});

redisClient.on("error", (err) => {
  console.error(" Redis connection error:", err);
});
