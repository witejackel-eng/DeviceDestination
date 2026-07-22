import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "authorization",
      "token",
      "accessToken",
      "customer.address",
      "customer.email",
      "customer.mobile",
    ],
    censor: "[redacted]",
  },
});
