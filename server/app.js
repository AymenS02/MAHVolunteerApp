import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createAuthLimiters } from "./middleware/rateLimit.js";
import authRoutes from "./routes/authRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const parseList = (value) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

// Builds the Express app without connecting to Mongo or listening, so tests
// can start their own instance with fresh rate limiters.
export const createApp = ({
  corsOrigins = parseList(process.env.CORS_ORIGINS),
  trustProxy = process.env.TRUST_PROXY,
  rateLimits = {},
} = {}) => {
  const app = express();

  // Behind a hosting proxy, req.ip is the proxy's address unless this is set.
  if (trustProxy) {
    app.set("trust proxy", Number(trustProxy) || trustProxy);
  }

  app.use(helmet());

  // Native apps send no Origin header, so CORS only restricts browsers
  // (e.g. the Expo web build). Unlisted origins get no CORS headers.
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || corsOrigins.includes(origin)),
    }),
  );

  app.use(express.json({ limit: "10kb" }));

  // Register is reachable at both paths, so both share one limiter.
  const { loginLimiter, registerLimiter } = createAuthLimiters(rateLimits);
  app.post("/api/auth/login", loginLimiter);
  app.post(["/api/auth/register", "/api/users"], registerLimiter);

  app.use("/api/users", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/events", eventRoutes);

  return app;
};
