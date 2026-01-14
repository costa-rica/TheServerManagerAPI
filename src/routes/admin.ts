import express from "express";
import type { Request, Response } from "express";
import { authenticateToken, isAdmin } from "../modules/authentication";
import { User } from "../models/user";
import { Machine } from "../models/machine";
import { checkBodyReturnMissing, isValidPagePath } from "../modules/common";
import fs from "fs";
import path from "path";
import logger from "../config/logger";

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// 🔹 GET /admin/users: Get all users with permissions (Admin only)
router.get("/users", isAdmin, async (req: Request, res: Response) => {
  try {
    const users = await User.find().select(
      "publicId email username isAdmin accessServersArray accessPagesArray"
    );

    res.json({
      success: true,
      users: users.map((user) => ({
        publicId: user.publicId,
        email: user.email,
        username: user.username,
        isAdmin: user.isAdmin,
        accessServersArray: user.accessServersArray,
        accessPagesArray: user.accessPagesArray,
      })),
    });
  } catch (error) {
    logger.error("Error getting users:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve users",
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
});

// 🔹 PATCH /admin/user/:userId/access-servers: Update user's server access (Admin only)
router.patch(
  "/user/:userId/access-servers",
  isAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { accessServersArray } = req.body;

      // Validate required fields
      const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
        "accessServersArray",
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

      // Validate that accessServersArray is an array
      if (!Array.isArray(accessServersArray)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: "accessServersArray must be an array of strings",
            status: 400,
          },
        });
      }

      // Validate that all machine publicIds exist
      if (accessServersArray.length > 0) {
        const machines = await Machine.find({
          publicId: { $in: accessServersArray },
        });

        if (machines.length !== accessServersArray.length) {
          const foundIds = machines.map((m) => m.publicId);
          const invalidIds = accessServersArray.filter(
            (id) => !foundIds.includes(id)
          );

          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid machine publicIds",
              details: `The following publicIds do not exist: ${invalidIds.join(
                ", "
              )}`,
              status: 400,
            },
          });
        }
      }

      // Find and update the user
      const user = await User.findOne({ publicId: userId });
      if (!user) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "User not found",
            status: 404,
          },
        });
      }

      user.accessServersArray = accessServersArray;
      await user.save();

      res.json({
        success: true,
        message: "Server access updated",
        user: {
          publicId: user.publicId,
          email: user.email,
          accessServersArray: user.accessServersArray,
        },
      });
    } catch (error) {
      logger.error("Error updating server access:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update server access",
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

// 🔹 PATCH /admin/user/:userId/access-pages: Update user's page access (Admin only)
router.patch(
  "/user/:userId/access-pages",
  isAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { accessPagesArray } = req.body;

      // Validate required fields
      const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
        "accessPagesArray",
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

      // Validate that accessPagesArray is an array
      if (!Array.isArray(accessPagesArray)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: "accessPagesArray must be an array of strings",
            status: 400,
          },
        });
      }

      // Validate each page path
      for (const pagePath of accessPagesArray) {
        if (!isValidPagePath(pagePath)) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid page path",
              details: `Page path "${pagePath}" is invalid. Must contain no spaces and only "/", "-", ".", or alphanumerics.`,
              status: 400,
            },
          });
        }
      }

      // Find and update the user
      const user = await User.findOne({ publicId: userId });
      if (!user) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "User not found",
            status: 404,
          },
        });
      }

      user.accessPagesArray = accessPagesArray;
      await user.save();

      res.json({
        success: true,
        message: "Page access updated",
        user: {
          publicId: user.publicId,
          email: user.email,
          accessPagesArray: user.accessPagesArray,
        },
      });
    } catch (error) {
      logger.error("Error updating page access:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update page access",
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

// 🔹 GET /admin/downloads: List all files in status_reports directory
router.get("/downloads", async (req: Request, res: Response) => {
  try {
    const statusReportsDir = path.join(
      process.env.PATH_PROJECT_RESOURCES || "",
      "status_reports"
    );

    // Check if directory exists
    if (!fs.existsSync(statusReportsDir)) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Status reports directory not found",
          details:
            process.env.NODE_ENV !== "production"
              ? `Path: ${statusReportsDir}`
              : undefined,
          status: 404,
        },
      });
    }

    // Read directory contents
    const files = await fs.promises.readdir(statusReportsDir);

    // Get file details (name, size, modified date)
    const fileDetails = await Promise.all(
      files.map(async (fileName) => {
        const filePath = path.join(statusReportsDir, fileName);
        const stats = await fs.promises.stat(filePath);

        return {
          fileName,
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(2),
          modifiedDate: stats.mtime,
          isFile: stats.isFile(),
        };
      })
    );

    // Filter to only include files (not directories)
    const filesOnly = fileDetails.filter((file) => file.isFile);

    res.json({
      directory: statusReportsDir,
      fileCount: filesOnly.length,
      files: filesOnly,
    });
  } catch (error) {
    logger.error("Error listing download files:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to list download files",
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
});

// 🔹 GET /admin/downloads/:filename: Download a specific file
router.get("/downloads/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Validate filename (prevent directory traversal)
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid filename",
          details: "Filename cannot contain path traversal characters",
          status: 400,
        },
      });
    }

    const statusReportsDir = path.join(
      process.env.PATH_PROJECT_RESOURCES || "",
      "status_reports"
    );

    const filePath = path.join(statusReportsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "File not found",
          status: 404,
        },
      });
    }

    // Check if it's a file (not a directory)
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Requested path is not a file",
          status: 400,
        },
      });
    }

    // Set headers for file download
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stats.size);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      logger.error("Error streaming file:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to stream file",
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
    });
  } catch (error) {
    logger.error("Error downloading file:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to download file",
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
});

export default router;
