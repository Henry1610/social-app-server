import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Generate a stable key based on email/phone, fallback to IP
const identifierKeyGen = (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/\D+/g, '') : undefined;
  return email || phone || ipKeyGenerator(req);
};

export const createLimiter = ({ windowMs = 60 * 1000, max = 3, keyGenerator = identifierKeyGen } = {}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
      const resetMs = req.rateLimit?.resetTime instanceof Date
        ? Math.max(0, req.rateLimit.resetTime.getTime() - Date.now())
        : windowMs;
      const retryAfter = Math.ceil(resetMs / 1000);
      console.warn(`[RATE_LIMIT] ${req.method} ${req.originalUrl} | key=${keyGenerator(req)} | retryAfter=${retryAfter}s`);
      return res.status(429).json({
        code: 'RATE_LIMITED',
        message: `Vui lòng thử lại sau ${retryAfter}s`,
        retryAfter,
      });
    },
  });
};

// Pre-configured limiters for auth flows
export const sendOtpLimiter = createLimiter({ windowMs: 60 * 1000, max: 3 });
export const resetPasswordRequestLimiter = createLimiter({ windowMs: 60 * 1000, max: 3 });


