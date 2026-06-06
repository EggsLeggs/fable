import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const configuredLevel = process.env.LOG_LEVEL?.trim();
const level =
  configuredLevel && configuredLevel.length > 0
    ? configuredLevel
    : isDev
      ? "debug"
      : "info";

export const logger = pino({
  level,
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "apiKey",
      "*.apiKey",
      "privateKey",
      "*.privateKey",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[redacted]",
  },
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "HH:MM:ss",
      },
    },
  }),
});

export const createLogger = (module: string) => logger.child({ module });
