import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { authenticateToken } from "../modules/authentication";
import { NginxFile } from "../models/nginxFile";
import { Machine } from "../models/machine";
import { checkBodyReturnMissing, isValidUUID } from "../modules/common";
import { verifyTemplateFileExists } from "../modules/fileValidation";
import {
	parseNginxConfig,
	populateNginxFilesWithMachineData,
} from "../modules/nginxParseConfig";
import { getMachineInfo } from "../modules/machines";
import { createNginxConfigFromTemplate } from "../modules/nginx";
import { generateNginxScanReport } from "../modules/nginxReports";
import logger from "../config/logger";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// 🔹 GET /nginx: Get all nginx config files with populated machine data
router.get("/", async (req: Request, res: Response) => {
  try {
    const nginxFiles = await NginxFile.find();

    // Populate nginx files with machine data (machineName and localIpAddress)
    // and strip MongoDB internal fields (_id, __v)
    const populatedNginxFiles =
      await populateNginxFilesWithMachineData(nginxFiles);

    res.json(populatedNginxFiles);
  } catch (error) {
    logger.error("Error fetching nginx files:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch nginx files",
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

// 🔹 GET /nginx/scan-nginx-dir: Scan nginx directory and parse config files
router.get("/scan-nginx-dir", async (req: Request, res: Response) => {
  try {
    // 1. Get current machine's local IP
    const { localIpAddress: currentMachineIp } = getMachineInfo();

    // 2. Look up nginxHostServerMachineId using current IP
    const nginxHostMachine = await Machine.findOne({
      localIpAddress: currentMachineIp,
    });
    if (!nginxHostMachine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Current machine not found in database",
          details: process.env.NODE_ENV !== 'production' ? `Current IP: ${currentMachineIp}` : undefined,
          status: 404
        }
      });
    }

    // 3. Read files from /etc/nginx/sites-available/
    const nginxDir = process.env.PATH_ETC_NGINX_SITES_AVAILABLE;
    let files: string[];

    try {
      files = await fs.promises.readdir(nginxDir);
    } catch (error) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to read nginx directory",
          details: process.env.NODE_ENV !== 'production' ? `${nginxDir}: ${error instanceof Error ? error.message : "Unknown error"}` : undefined,
          status: 500
        }
      });
    }

    // 4. Filter out 'default'
    const configFiles = files.filter((file) => file !== "default");

    // 5. Parse each file
    const newEntries = [];
    const duplicates = [];
    const errors = [];

    for (const file of configFiles) {
      try {
        const filePath = path.join(nginxDir, file);
        const content = await fs.promises.readFile(filePath, "utf-8");
        const parsed = parseNginxConfig(content);

        // Skip if no server names found
        if (parsed.serverNames.length === 0) {
          errors.push({
            fileName: file,
            error: "No server names found in config file",
          });
          continue;
        }

        // Look up appHostServerMachinePublicId
        let appHostMachine = null;
        if (parsed.localIpAddress) {
          appHostMachine = await Machine.findOne({
            localIpAddress: parsed.localIpAddress,
          });
        }

        // Check for duplicates by primary server name
        const primaryServerName = parsed.serverNames[0];
        const existing = await NginxFile.findOne({
          serverName: primaryServerName,
        });

        if (existing) {
          duplicates.push({
            fileName: file,
            serverName: primaryServerName,
            additionalServerNames: parsed.serverNames.slice(1),
            portNumber: parsed.listenPort,
            localIpAddress: parsed.localIpAddress,
            framework: parsed.framework,
            reason: "Server name already exists in database",
          });
        } else {
          // Prepare new entry data
          const newEntryData = {
            publicId: randomUUID(),
            serverName: primaryServerName,
            serverNameArrayOfAdditionalServerNames: parsed.serverNames.slice(1),
            portNumber: parsed.listenPort || 0,
            appHostServerMachinePublicId: appHostMachine?.publicId || null,
            nginxHostServerMachinePublicId: nginxHostMachine.publicId,
            framework: parsed.framework,
            storeDirectory: nginxDir,
          };

          // Insert into database
          const createdEntry = await NginxFile.create(newEntryData);

          newEntries.push({
            fileName: file,
            serverName: primaryServerName,
            additionalServerNames: parsed.serverNames.slice(1),
            portNumber: parsed.listenPort,
            localIpAddress: parsed.localIpAddress,
            framework: parsed.framework,
            appHostMachineFound: !!appHostMachine,
            publicId: createdEntry.publicId,
          });
        }
      } catch (error) {
        errors.push({
          fileName: file,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // 6. Generate CSV report
    const reportPath = generateNginxScanReport(newEntries, duplicates, errors);

    // 7. Return response
    res.json({
      scanned: configFiles.length,
      new: newEntries.length,
      duplicates: duplicates.length,
      errors: errors.length,
      currentMachineIp,
      nginxHostMachinePublicId: nginxHostMachine.publicId,
      reportPath,
      newEntries,
      duplicateEntries: duplicates,
      errorEntries: errors,
    });
  } catch (error) {
    logger.error("Error scanning nginx directory:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to scan nginx directory",
        details: process.env.NODE_ENV !== 'production' ? (error instanceof Error ? error.message : "Unknown error") : undefined,
        status: 500
      }
    });
  }
});

// 🔹 POST /nginx/create-config-file: Create nginx configuration file
router.post("/create-config-file", async (req: Request, res: Response) => {
  // Log request body for testing
  logger.info("📥 POST /nginx/create-config-file - Request body:");
  logger.info(JSON.stringify(req.body, null, 2));
  logger.info("Body type:", typeof req.body);
  logger.info("Body keys:", Object.keys(req.body || {}));
  try {
    // Validate required fields
    const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
      "templateFileName",
      "serverNamesArray",
      "appHostServerMachinePublicId",
      "portNumber",
      "saveDestination",
    ]);

    if (!isValid) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: `Missing required fields: ${missingKeys.join(", ")}`,
          status: 400
        }
      });
    }

    const {
      templateFileName,
      serverNamesArray,
      appHostServerMachinePublicId,
      portNumber,
      saveDestination,
    } = req.body;

    // Validate and map templateFileName to actual file
    if (
      typeof templateFileName !== "string" ||
      templateFileName.trim() === ""
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "templateFileName must be a non-empty string",
          status: 400
        }
      });
    }

    // Map template type to actual filename
    const templateFileMap: Record<string, string> = {
      expressJs: "expressJsSitesAvailable.txt",
      nextJsPython: "nextJsPythonSitesAvailable.txt",
    };

    const actualTemplateFileName = templateFileMap[templateFileName];
    if (!actualTemplateFileName) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid templateFileName",
          details: `Must be one of: ${Object.keys(templateFileMap).join(", ")}`,
          status: 400
        }
      });
    }

    // Validate serverNamesArray (array of strings)
    if (!Array.isArray(serverNamesArray) || serverNamesArray.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "serverNamesArray must be a non-empty array",
          status: 400
        }
      });
    }

    if (
      !serverNamesArray.every(
        (name) => typeof name === "string" && name.trim() !== ""
      )
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "All server names must be non-empty strings",
          status: 400
        }
      });
    }

    // Validate appHostServerMachinePublicId (non-empty string)
    if (
      typeof appHostServerMachinePublicId !== "string" ||
      appHostServerMachinePublicId.trim() === ""
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "appHostServerMachinePublicId must be a non-empty string",
          status: 400
        }
      });
    }

    // Verify machine exists in database
    const machine = await Machine.findOne({
      publicId: appHostServerMachinePublicId,
    });
    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found",
          details: "Machine with specified appHostServerMachinePublicId not found",
          status: 404
        }
      });
    }

    // Validate portNumber (number, 1-65535)
    if (
      typeof portNumber !== "number" ||
      portNumber < 1 ||
      portNumber > 65535
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "portNumber must be a number between 1 and 65535",
          status: 400
        }
      });
    }

    // Validate saveDestination (must be a non-empty string path)
    if (typeof saveDestination !== "string" || saveDestination.trim() === "") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "saveDestination must be a non-empty string path",
          status: 400
        }
      });
    }

    // Verify template file exists
    const fileValidation = verifyTemplateFileExists(actualTemplateFileName);
    if (!fileValidation.exists) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Template file not found",
          details: process.env.NODE_ENV !== 'production' ? fileValidation.error : undefined,
          status: 404
        }
      });
    }

    // Get current machine's IP to find nginxHostServerMachineId
    const { localIpAddress: currentMachineIp } = getMachineInfo();
    const nginxHostMachine = await Machine.findOne({
      localIpAddress: currentMachineIp,
    });

    if (!nginxHostMachine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Current machine not found in database",
          details: process.env.NODE_ENV !== 'production' ? `Current IP: ${currentMachineIp}` : undefined,
          status: 404
        }
      });
    }

    // Machine document already validated and fetched above (line 217)
    // Use it to get the local IP address
    if (!machine.localIpAddress) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Machine configuration error",
          details: process.env.NODE_ENV !== 'production' ? "Machine document does not have a localIpAddress field" : undefined,
          status: 500
        }
      });
    }

    // Create nginx config file from template
    const configResult = await createNginxConfigFromTemplate({
      templateFilePath: fileValidation.fullPath!,
      serverNamesArray,
      localIpAddress: machine.localIpAddress,
      portNumber,
      saveDestination,
    });

    if (!configResult.success) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create nginx config file",
          details: process.env.NODE_ENV !== 'production' ? configResult.error : undefined,
          status: 500
        }
      });
    }

    // Determine framework (default to ExpressJs)
    // Note: Could be enhanced to detect framework from template or request
    const framework = "ExpressJs";

    // Use saveDestination as the storeDirectory
    const storeDirectory = saveDestination;

    // Auto-generate publicId
    const publicId = randomUUID();

    // Create NginxFile database record
    const nginxFileRecord = await NginxFile.create({
      publicId,
      serverName: serverNamesArray[0],
      serverNameArrayOfAdditionalServerNames: serverNamesArray.slice(1),
      portNumber,
      appHostServerMachinePublicId,
      nginxHostServerMachinePublicId: nginxHostMachine.publicId,
      framework,
      storeDirectory,
    });

    res.status(201).json({
      message: "Nginx config file created successfully",
      filePath: configResult.filePath,
      databaseRecord: nginxFileRecord,
    });
  } catch (error) {
    logger.error("Error creating nginx config file:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create nginx config file",
        details: process.env.NODE_ENV !== 'production' ? (error instanceof Error ? error.message : "Unknown error") : undefined,
        status: 500
      }
    });
  }
});

// 🔹 DELETE /nginx/clear: Clear all nginx files from database
router.delete("/clear", async (req: Request, res: Response) => {
  try {
    const result = await NginxFile.deleteMany({});

    res.json({
      message: "NginxFiles collection cleared successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    logger.error("Error clearing nginx files:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to clear nginx files",
        details: process.env.NODE_ENV !== 'production' ? (error instanceof Error ? error.message : "Unknown error") : undefined,
        status: 500
      }
    });
  }
});

// 🔹 GET /nginx/config-file/:nginxFilePublicId: Get nginx config file contents
router.get("/config-file/:nginxFilePublicId", async (req: Request, res: Response) => {
  try {
    const { nginxFilePublicId } = req.params;

    // Validate publicId format (UUID v4)
    if (!isValidUUID(nginxFilePublicId)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid nginxFilePublicId format",
          details: "nginxFilePublicId must be a valid UUID v4",
          status: 400,
        },
      });
    }

    // Find the configuration document
    const config = await NginxFile.findOne({ publicId: nginxFilePublicId });
    if (!config) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Configuration not found",
          details: "Nginx configuration with specified publicId not found",
          status: 404,
        },
      });
    }

    // Construct file path
    const filePath = path.join(config.storeDirectory, config.serverName);

    // Read the file
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      logger.info(`📖 Read nginx config file: ${filePath}`);

      res.json({
        content,
        filePath,
        serverName: config.serverName,
      });
    } catch (error: any) {
      // Handle file read errors
      if (error.code === "ENOENT") {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Configuration file not found on disk",
            details:
              process.env.NODE_ENV !== "production"
                ? `File not found: ${filePath}`
                : undefined,
            status: 404,
          },
        });
      } else if (error.code === "EACCES") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Permission denied reading configuration file",
            details:
              process.env.NODE_ENV !== "production"
                ? `Access denied: ${filePath}`
                : undefined,
            status: 500,
          },
        });
      } else {
        throw error; // Re-throw unexpected errors
      }
    }
  } catch (error) {
    logger.error("Error reading nginx config file:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to read nginx configuration file",
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

// 🔹 POST /nginx/config-file/:nginxFilePublicId: Update nginx config file with validation
router.post("/config-file/:nginxFilePublicId", async (req: Request, res: Response) => {
  try {
    const { nginxFilePublicId } = req.params;
    const { content } = req.body;

    // Validate publicId format (UUID v4)
    if (!isValidUUID(nginxFilePublicId)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid nginxFilePublicId format",
          details: "nginxFilePublicId must be a valid UUID v4",
          status: 400,
        },
      });
    }

    // Validate content is provided
    if (!content || typeof content !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "Missing or invalid 'content' field in request body. Must be a non-empty string.",
          status: 400,
        },
      });
    }

    // Find the configuration document
    const config = await NginxFile.findOne({ publicId: nginxFilePublicId });
    if (!config) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Configuration not found",
          details: "Nginx configuration with specified publicId not found",
          status: 404,
        },
      });
    }

    // Construct file path
    const filePath = path.join(config.storeDirectory, config.serverName);
    const backupPath = `${filePath}.backup.${Date.now()}`;

    logger.info(`📝 Updating nginx config file: ${filePath}`);
    logger.info(`📝 Store directory: ${config.storeDirectory}`);
    logger.info(`📝 Server name: ${config.serverName}`);
    logger.info(`📝 Backup path: ${backupPath}`);

    try {
      // Step 1: Create backup of original file
      try {
        logger.info(`💾 Attempting to create backup using fs.copyFile...`);
        logger.info(`💾 Source: ${filePath}`);
        logger.info(`💾 Destination: ${backupPath}`);
        await fs.promises.copyFile(filePath, backupPath);
        logger.info(`💾 Created backup: ${backupPath}`);
      } catch (error: any) {
        logger.error(`❌ Backup creation failed with error code: ${error.code}`);
        logger.error(`❌ Error message: ${error.message}`);
        logger.error(`❌ Full error:`, error);
        if (error.code === "ENOENT") {
          return res.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: "Configuration file not found on disk",
              details:
                process.env.NODE_ENV !== "production"
                  ? `File not found: ${filePath}`
                  : undefined,
              status: 404,
            },
          });
        } else if (error.code === "EACCES") {
          return res.status(500).json({
            error: {
              code: "INTERNAL_ERROR",
              message: "Permission denied creating backup",
              details:
                process.env.NODE_ENV !== "production"
                  ? `Access denied: ${filePath}`
                  : undefined,
              status: 500,
            },
          });
        } else {
          throw error;
        }
      }

      // Step 2: Write new content to file
      try {
        logger.info(`✍️  Attempting to write new content to: ${filePath}`);
        logger.info(`✍️  Content length: ${content.length} characters`);
        await fs.promises.writeFile(filePath, content, "utf-8");
        logger.info(`✍️  Successfully wrote new content to: ${filePath}`);
      } catch (error: any) {
        logger.error(`❌ Write failed with error code: ${error.code}`);
        logger.error(`❌ Write error message: ${error.message}`);
        // Restore backup on write failure
        await fs.promises.rename(backupPath, filePath);
        logger.error(`❌ Failed to write new content, restored backup`);

        if (error.code === "EACCES") {
          return res.status(500).json({
            error: {
              code: "INTERNAL_ERROR",
              message: "Permission denied writing configuration file",
              details:
                process.env.NODE_ENV !== "production"
                  ? `Access denied: ${filePath}`
                  : undefined,
              status: 500,
            },
          });
        } else {
          throw error;
        }
      }

      // Step 3: Run nginx -t to validate
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      try {
        logger.info(`🔍 Running nginx -t validation...`);
        const { stdout, stderr } = await execAsync("sudo nginx -t");
        logger.info(`✅ nginx -t passed`);
        logger.info(`nginx -t stdout: ${stdout}`);
        logger.info(`nginx -t stderr: ${stderr}`);

        // Step 4a: Success - Delete backup
        await fs.promises.unlink(backupPath);
        logger.info(`🗑️  Deleted backup: ${backupPath}`);

        res.json({
          message: "Nginx configuration updated successfully",
          filePath,
          serverName: config.serverName,
          validationPassed: true,
        });
      } catch (nginxTestError: any) {
        // Step 4b: nginx -t failed - Restore backup
        logger.error(`❌ nginx -t failed, restoring backup`);

        try {
          await fs.promises.rename(backupPath, filePath);
          logger.info(`♻️  Restored backup: ${backupPath} -> ${filePath}`);
        } catch (restoreError) {
          logger.error(`⚠️  CRITICAL: Failed to restore backup:`, restoreError);
          // Even if restore fails, still return the nginx -t error
        }

        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Nginx configuration validation failed",
            details:
              process.env.NODE_ENV !== "production"
                ? `nginx -t failed: ${nginxTestError.stderr || nginxTestError.message}`
                : "Invalid nginx configuration syntax. Changes have been reverted.",
            status: 400,
          },
        });
      }
    } catch (error: any) {
      // Clean up backup if it exists
      try {
        await fs.promises.unlink(backupPath);
        logger.info(`🗑️  Cleaned up backup after error: ${backupPath}`);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw error; // Re-throw to outer catch
    }
  } catch (error) {
    logger.error("Error updating nginx config file:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update nginx configuration file",
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

// 🔹 DELETE /nginx/:publicId: Delete nginx config file and database record
router.delete("/:publicId", async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;

    // Validate publicId format (UUID v4)
    if (!isValidUUID(publicId)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid publicId format",
          details: "publicId must be a valid UUID v4",
          status: 400,
        },
      });
    }

    // Find the configuration document
    const config = await NginxFile.findOne({ publicId });
    if (!config) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Configuration not found",
          status: 404,
        },
      });
    }

    // Construct file path
    const filePath = path.join(config.storeDirectory, config.serverName);

    // Delete physical file (continue even if file doesn't exist)
    try {
      await fs.promises.unlink(filePath);
      logger.info(`🗑️  Deleted nginx config file: ${filePath}`);
    } catch (error) {
      // Log warning but continue - file may already be deleted
      logger.warn(
        `⚠️  File not found (will still delete DB entry): ${filePath}`
      );
    }

    // Delete database document
    await NginxFile.findOneAndDelete({ publicId });

    res.json({
      message: "Nginx configuration deleted successfully",
      serverName: config.serverName,
      filePath,
    });
  } catch (error) {
    logger.error("Error deleting nginx configuration:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete nginx configuration",
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

export default router;
