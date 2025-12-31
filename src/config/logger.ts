/**
 * Winston Logger Configuration for The Server Manager API
 *
 * This module configures Winston logging for the parent process.
 * Based on LOGGING_NODE_JS_V03.md documentation.
 *
 * Environment Variables Required:
 * - NODE_ENV: Environment mode (development/testing/production)
 * - NAME_APP: Application identifier for log filenames
 * - PATH_TO_LOGS: Directory path for log file storage (testing & production)
 * - LOG_MAX_SIZE: Maximum size per log file (optional, default: 10MB)
 * - LOG_MAX_FILES: Maximum number of log files to retain (optional, default: 10)
 *
 * V03 Three-Tier Behavior:
 * - development: Console output, all log levels (debug+)
 * - testing: File output, info+ levels (error, warn, info, http)
 * - production: File output, error level only
 */

import winston from "winston";
import path from "path";

// Determine environment
const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const isTesting = nodeEnv === "testing";
const isDevelopment = nodeEnv === "development";

const appName = process.env.NAME_APP || "app";
const logDir = process.env.PATH_TO_LOGS || "./logs";
const maxSize = parseInt(process.env.LOG_MAX_SIZE || "10485760"); // 10MB default
const maxFiles = parseInt(process.env.LOG_MAX_FILES || "10");

// Determine log level based on environment
let logLevel: string;
if (isProduction) {
  logLevel = "error"; // Only errors in production
} else if (isTesting) {
  logLevel = "info"; // Info and above in testing
} else {
  logLevel = "debug"; // All levels in development
}

// Define log format for production (human-readable with timestamps)
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `[${timestamp}] [${level.toUpperCase()}] [${appName}] ${message}${metaStr}`;
  })
);

// Define log format for development (colorized, simpler)
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `${timestamp} ${level} [${appName}] ${message}${metaStr}`;
  })
);

// Create the Winston logger
const logger = winston.createLogger({
  level: logLevel,
  format: isProduction || isTesting ? productionFormat : developmentFormat,
  transports: [],
});

// Add transports based on environment
if (isProduction || isTesting) {
  // Production and Testing: Write to rotating log files
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, `${appName}.log`),
      maxsize: maxSize,
      maxFiles: maxFiles,
      tailable: true,
    })
  );
} else {
  // Development: Console output with colors
  logger.add(new winston.transports.Console());
}

// Log initialization
let environmentMode: string;
if (isProduction) {
  environmentMode = "production (error-only logging)";
} else if (isTesting) {
  environmentMode = "testing (file-based logging)";
} else {
  environmentMode = "development (console logging)";
}
logger.info(`Logger V03 initialized for ${appName} in ${environmentMode}`);

export default logger;
