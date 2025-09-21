import Redis from "ioredis";

export const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD || undefined, 

});

redisClient.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

// Test ping
redisClient.ping().then((res) => {
  console.log("Ping response:", res); // phải in ra "PONG"
}).catch((err) => {
  console.error("Ping failed:", err);
});