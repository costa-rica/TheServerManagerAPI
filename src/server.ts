// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

// Initialize Winston logger (must be imported before other modules)
import logger from "./config/logger";

// Import the configured app after logger is initialized
import app from "./app";

const PORT = parseInt(process.env.PORT || "3000", 10);

// Capture stack traces for errors
process.on("uncaughtException", (err: Error) => {
  logger.error("There is an error");
  logger.error(`Uncaught Exception: ${err.message}`);
  logger.error(`Stack Trace:\n${err.stack}`);
  process.exit(1); // Exit the process to avoid undefined behavior
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<any>) => {
  logger.error(`Unhandled Rejection at:`, promise);
  if (reason instanceof Error) {
    logger.error(`Reason: ${reason.message}`);
    logger.error(`Stack Trace:\n${reason.stack}`);
  } else {
    logger.error(`Reason:`, reason);
  }
});

// Start the server
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server running on http://0.0.0.0:${PORT}`);
});
