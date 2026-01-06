/**
 * Winston Logger Configuration for The Server Manager API
 *
 * This module configures Winston logging for the parent process.
 * Based on LOGGING_NODE_JS_V04.md documentation.
 *
 * Environment Variables Required:
 * - NODE_ENV: Environment mode (development/testing/production)
 * - NAME_APP: Application identifier for log filenames
 * - PATH_TO_LOGS: Directory path for log file storage (testing & production)
 * - LOG_MAX_SIZE: Maximum size per log file in MB (optional, default: 5)
 * - LOG_MAX_FILES: Maximum number of log files to retain (optional, default: 5)
 *
 * V04 Three-Tier Behavior:
 * - development: Console output only, all log levels (debug+)
 * - testing: Console AND file output, info+ levels (error, warn, info, http)
 * - production: File output only, info+ levels (error, warn, info, http)
 */

import winston from "winston";
import path from "path";

// ========================================
// V04 Requirement: Startup Validation
// Validate required environment variables before logger initialization
// ========================================
const requiredEnvVars = ["NODE_ENV", "NAME_APP", "PATH_TO_LOGS"];
const missingVars: string[] = [];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  console.error(
    `[FATAL ERROR] Missing required environment variable(s): ${missingVars.join(", ")}`
  );
  console.error(
    "Logger cannot be initialized. Please set the required variables in your .env file."
  );
  process.exit(1);
}

// Determine environment
const nodeEnv = process.env.NODE_ENV!; // Safe to use ! after validation
const isProduction = nodeEnv === "production";
const isTesting = nodeEnv === "testing";
const isDevelopment = nodeEnv === "development";

const appName = process.env.NAME_APP!; // Safe to use ! after validation
const logDir = process.env.PATH_TO_LOGS!; // Safe to use ! after validation

// V04: LOG_MAX_SIZE is in megabytes, convert to bytes for Winston
const maxSizeMB = parseInt(process.env.LOG_MAX_SIZE || "5"); // 5MB default (V04)
const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
const maxFiles = parseInt(process.env.LOG_MAX_FILES || "5"); // 5 files default (V04)

// Determine log level based on environment
let logLevel: string;
if (isProduction) {
  logLevel = "info"; // V04: Info and above in production (error, warn, info, http)
} else if (isTesting) {
  logLevel = "info"; // V04: Info and above in testing (error, warn, info, http)
} else {
  logLevel = "debug"; // V04: All levels in development (debug+)
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
if (isDevelopment) {
  // V04 Development: Console output only with colors
  logger.add(new winston.transports.Console());
} else if (isTesting) {
  // V04 Testing: BOTH console AND file output
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, `${appName}.log`),
      maxsize: maxSize,
      maxFiles: maxFiles,
      tailable: true,
    })
  );
  logger.add(new winston.transports.Console());
} else if (isProduction) {
  // V04 Production: File output only
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, `${appName}.log`),
      maxsize: maxSize,
      maxFiles: maxFiles,
      tailable: true,
    })
  );
}

// Log initialization
let environmentMode: string;
if (isProduction) {
  environmentMode = "production (file output, info+ levels)";
} else if (isTesting) {
  environmentMode = "testing (console + file output, info+ levels)";
} else {
  environmentMode = "development (console output, debug+ levels)";
}
logger.info(`Logger V04 initialized for ${appName} in ${environmentMode}`);

export default logger;
