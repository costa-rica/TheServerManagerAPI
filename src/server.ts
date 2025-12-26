// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

// Initialize Winston logger (must be imported before other modules to intercept console methods)
// Import with side-effect syntax to ensure it's not stripped during compilation
import "./config/logger";

// Import the configured app after logger is initialized
import app from "./app";

const PORT = parseInt(process.env.PORT || "3000", 10);

// Capture stack traces for errors
process.on("uncaughtException", (err: Error) => {
  console.error("There is an error");
  console.error(`Uncaught Exception: ${err.message}`);
  console.error(`Stack Trace:\n${err.stack}`);
  process.exit(1); // Exit the process to avoid undefined behavior
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<any>) => {
  console.error(`Unhandled Rejection at:`, promise);
  if (reason instanceof Error) {
    console.error(`Reason: ${reason.message}`);
    console.error(`Stack Trace:\n${reason.stack}`);
  } else {
    console.error(`Reason:`, reason);
  }
});

// Start the server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
