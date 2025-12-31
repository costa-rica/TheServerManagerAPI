import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { User } from "../models/user";
import crypto from "crypto";
import logger from "../config/logger";

export function verifyCheckDirectoryExists(): void {
  // Add directory paths to check (and create if they don't exist)
  const pathsToCheck = [
    process.env.PATH_DATABASE,
    process.env.PATH_PROJECT_RESOURCES,
  ].filter((path): path is string => typeof path === "string");

  pathsToCheck.forEach((dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    }
  });

  // Create status_reports subdirectory in PATH_PROJECT_RESOURCES
  if (process.env.PATH_PROJECT_RESOURCES) {
    const statusReportsDir = path.join(
      process.env.PATH_PROJECT_RESOURCES,
      "status_reports"
    );
    if (!fs.existsSync(statusReportsDir)) {
      fs.mkdirSync(statusReportsDir, { recursive: true });
      logger.info(`Created directory: ${statusReportsDir}`);
    }
  }
}

export async function onStartUpCreateEnvUsers(): Promise<void> {
  if (!process.env.ADMIN_EMAIL) {
    logger.warn("⚠️ No admin emails found in env variables.");
    return;
  }

  let adminEmails: string[];
  try {
    adminEmails = JSON.parse(process.env.ADMIN_EMAIL);
    if (!Array.isArray(adminEmails)) throw new Error();
  } catch (error) {
    logger.error(
      "❌ Error parsing ADMIN_EMAIL. Ensure it's a valid JSON array."
    );
    return;
  }

  for (const email of adminEmails) {
    try {
      const existingUser = await User.findOne({ email });

      if (!existingUser) {
        logger.info(`🔹 Creating admin user: ${email}`);

        const hashedPassword = await bcrypt.hash("test", 10); // Default password, should be changed later.

        await User.create({
          publicId: crypto.randomUUID(),
          username: email.split("@")[0],
          email,
          password: hashedPassword,
        });

        logger.info(`✅ Admin user created: ${email}`);
      } else {
        logger.info(`ℹ️  User already exists: ${email}`);
      }
    } catch (err) {
      logger.error(`❌ Error creating admin user (${email}):`, err);
    }
  }
}
