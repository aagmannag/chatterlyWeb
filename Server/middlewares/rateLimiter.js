import { rateLimit } from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1-minute window
  limit: 500,                 // 500 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.method === "OPTIONS") return true;
    // Skip all high-frequency routes so normal usage is never blocked
    const p = req.path;
    if (
      p.startsWith("/api/chat/") ||
      p.startsWith("/api/keys/") ||
      p.startsWith("/api/users") ||
      p.startsWith("/api/status") ||
      p === "/api/auth/me"      // called on every page load / token refresh
    ) return true;
    return false;
  },
  handler: (_req, res) => {
    res.status(429).json({ success: false, message: "Too many requests — please slow down." });
  },
});
