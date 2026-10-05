import { ipKeyGenerator, rateLimit } from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const envNumber = (value, fallback) => Number(value) || fallback;

export const createAuthLimiters = ({
  loginMax = envNumber(process.env.LOGIN_RATE_LIMIT, 10),
  registerMax = envNumber(process.env.REGISTER_RATE_LIMIT, 5),
  passwordMax = envNumber(process.env.PASSWORD_RATE_LIMIT, 5),
} = {}) => ({
  // Runs after auth, so it's keyed by the signed-in user rather than the IP.
  passwordLimiter: rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: passwordMax,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `user:${req.user._id}`,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Too many password attempts. Try again in 15 minutes.",
    },
  }),
  // Keyed by IP and email: volunteers at an event often share one Wi-Fi IP,
  // so one person's typos shouldn't lock everyone else out.
  loginLimiter: rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: loginMax,
    skipSuccessfulRequests: true,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip ?? "")}:${String(req.body?.email ?? "")
        .trim()
        .toLowerCase()}`,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again in 15 minutes." },
  }),
  registerLimiter: rateLimit({
    windowMs: ONE_HOUR,
    limit: registerMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Too many accounts created from this network. Try again later.",
    },
  }),
});
