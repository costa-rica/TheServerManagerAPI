import express from "express";
import logger from "./config/logger";

const app = express();
import path from "path";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";

// Import MongoDB connection
import connectDB from "./models/connection";
// Import onStartUp functions
import {
  verifyCheckDirectoryExists,
  onStartUpCreateEnvUsers,
} from "./modules/onStartUp";

import indexRouter from "./routes/index";
import usersRouter from "./routes/users";
import machinesRouter from "./routes/machines";
import servicesRouter from "./routes/services";
import nginxRouter from "./routes/nginx";
import adminRouter from "./routes/admin";
import registrarRouter from "./routes/registrar";

// Verify and create necessary directories first
verifyCheckDirectoryExists();

// logger.info("TEST: app.ts loaded - monkey-patching test");
// Middleware configuration (must be BEFORE routes)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies
app.use(morgan("dev")); // HTTP request logging

// CORS configuration (must be BEFORE routes)
app.use(
  cors({
    credentials: true,
    exposedHeaders: ["Content-Disposition"], // <-- this line is key
  })
);

// Register routes
app.use("/users", usersRouter);
app.use("/machines", machinesRouter);
app.use("/services", servicesRouter);
app.use("/nginx", nginxRouter);
app.use("/admin", adminRouter);
app.use("/registrar", registrarRouter);
app.use("/", indexRouter);

// Initialize database and startup functions
async function initializeApp() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Run startup functions after database is ready
    await onStartUpCreateEnvUsers();

    logger.info("✅ App initialization completed");
  } catch (err) {
    logger.error("❌ App initialization failed:", err);
    process.exit(1);
  }
}

// Initialize the app when this module is imported
initializeApp();

// Export the app for server.ts to use
export default app;
