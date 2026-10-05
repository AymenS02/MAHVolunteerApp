import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuthLimiters } from "./middleware/rateLimit.js";
import authRoutes from "./routes/authRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import { createUserRoutes } from "./routes/userRoutes.js";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

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
  const { loginLimiter, registerLimiter, passwordLimiter } =
    createAuthLimiters(rateLimits);
  app.post("/api/auth/login", loginLimiter);
  app.post(["/api/auth/register", "/api/users"], registerLimiter);

  app.use("/api/users", createUserRoutes({ passwordLimiter }));
  app.use("/api/auth", authRoutes);
  app.use("/api/events", eventRoutes);

  // Public pages the App Store listing links to: /privacy and /support.
  app.use(express.static(PUBLIC_DIR, { extensions: ["html"], index: false }));

  // JSON instead of Express's HTML pages, which include stack traces in dev.
  app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // eslint-disable-next-line no-unused-vars -- Express needs all 4 args
  app.use((error, req, res, next) => {
    const status = error.status ?? error.statusCode ?? 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
      message: status >= 500 ? "Something went wrong" : "Invalid request",
    });
  });

  return app;
};
