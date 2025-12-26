/**
 * Winston Logger Configuration for The Server Manager API
 *
 * This module configures Winston logging for the parent process.
 * Based on LOGGING_NODE_JS_V02.md documentation.
 *
 * Environment Variables Required:
 * - NODE_ENV: Environment mode (production/development)
 * - NAME_APP: Application identifier for log filenames
 * - PATH_TO_LOGS: Directory path for log file storage (production only)
 * - LOG_MAX_SIZE: Maximum size per log file (optional, default: 10MB)
 * - LOG_MAX_FILES: Maximum number of log files to retain (optional, default: 10)
 */

import winston from "winston";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";
const appName = process.env.NAME_APP || "app";
const logDir = process.env.PATH_TO_LOGS || "./logs";
const maxSize = parseInt(process.env.LOG_MAX_SIZE || "10485760"); // 10MB default
const maxFiles = parseInt(process.env.LOG_MAX_FILES || "10");

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
	level: isProduction ? "info" : "debug",
	format: isProduction ? productionFormat : developmentFormat,
	transports: [],
});

// Add transports based on environment
if (isProduction) {
	// Production: Write to rotating log files
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

// Monkey-patch console methods to use Winston
const originalConsole = {
	log: console.log,
	error: console.error,
	warn: console.warn,
	info: console.info,
	debug: console.debug,
};

console.log = (...args: any[]) => logger.info(args.join(" "));
console.error = (...args: any[]) => logger.error(args.join(" "));
console.warn = (...args: any[]) => logger.warn(args.join(" "));
console.info = (...args: any[]) => logger.info(args.join(" "));
console.debug = (...args: any[]) => logger.debug(args.join(" "));

// Log initialization
logger.info(`Logger initialized for ${appName} in ${isProduction ? "production" : "development"} mode`);

export default logger;
