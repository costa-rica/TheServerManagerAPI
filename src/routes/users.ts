import express from "express";
import type { Request, Response } from "express";
import { checkBodyReturnMissing } from "../modules/common";
import { User } from "../models/user";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendResetPasswordEmail } from "../modules/mailer";
import logger from "../config/logger";

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.send("users endpoint");
});

// 🔹 POST /users/register: Register User (Create)
router.post("/register", async (req, res) => {
  const { password, email } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
    "password",
    "email",
  ]);

  if (!isValid) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: `Missing required fields: ${missingKeys.join(", ")}`,
        status: 400,
      },
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "User already exists",
        details: "A user with this email address is already registered",
        status: 409,
      },
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    username: email.split("@")[0],
    password: hashedPassword,
    email,
  });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

  res.status(201).json({
    message: "User created successfully",
    token,
    user: { username: user.username, email: user.email },
  });
});

// 🔹 POST /users/login: Login User (Read)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
    "email",
    "password",
  ]);

  if (!isValid) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: `Missing required fields: ${missingKeys.join(", ")}`,
        status: 400,
      },
    });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({
      error: {
        code: "AUTH_FAILED",
        message: "Invalid credentials",
        status: 401,
      },
    });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({
      error: {
        code: "AUTH_FAILED",
        message: "Invalid credentials",
        status: 401,
      },
    });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
  res.json({
    message: "User logged in successfully",
    token,
    user: { username: user.username, email: user.email, isAdmin: user.isAdmin },
  });
  // res.status(500).json({ error: "Testing this error" });
});

// 🔹 POST /users/request-reset-password-email
router.post(
  "/request-reset-password-email",
  async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "Email is required",
          status: 400,
        },
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "User not found",
          status: 404,
        },
      });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    // logger.info("[ POST /users/request-reset-password-email 1]token:", token);

    await sendResetPasswordEmail(email, token)
      .then(() => logger.info("Email sent successfully"))
      .catch((error) => logger.error("Email failed:", error));

    res.status(200).json({ message: "Email sent successfully" });
  }
);

// 🔹 POST /users/reset-password-with-new-password
router.post(
  "/reset-password-with-new-password",
  async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    // Validate required fields
    const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
      "token",
      "newPassword",
    ]);

    if (!isValid) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: `Missing required fields: ${missingKeys.join(", ")}`,
          status: 400,
        },
      });
    }

    try {
      // Verify the JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
      };

      // Find the user by ID from the token
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "User not found",
            status: 404,
          },
        });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the user's password
      user.password = hashedPassword;
      await user.save();

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      // Handle token verification errors
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          error: {
            code: "AUTH_FAILED",
            message: "Invalid or expired token",
            status: 401,
          },
        });
      }
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          error: {
            code: "AUTH_FAILED",
            message: "Reset token has expired",
            status: 401,
          },
        });
      }

      logger.error("Error resetting password:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to reset password",
          details:
            process.env.NODE_ENV !== "production"
              ? error instanceof Error
                ? error.message
                : "Unknown error"
              : undefined,
          status: 500,
        },
      });
    }
  }
);

export default router;
