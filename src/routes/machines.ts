import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { Machine } from "../models/machine";
import { checkBodyReturnMissing } from "../modules/common";
import {
  getMachineInfo,
  getServicesNameAndValidateServiceFile,
  buildServicesArrayFromNickSystemctl,
} from "../modules/machines";
import { authenticateToken } from "../modules/authentication";
import logger from "../config/logger";

const router = express.Router();

// 🔹 GET /machines/name: Get machine name and local IP address
router.get("/name", authenticateToken, (req: Request, res: Response) => {
  try {
    const machineInfo = getMachineInfo();
    res.json(machineInfo);
  } catch (error: any) {
    logger.error("Error getting machine info:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve machine information",
        details:
          process.env.NODE_ENV !== "production" ? error.message : undefined,
        status: 500,
      },
    });
  }
});

// 🔹 GET /machines/syslog: Get the entire syslog file
router.get("/syslog", authenticateToken, async (req: Request, res: Response) => {
  try {
    logger.info("[machines.ts] GET /machines/syslog - Reading syslog file");

    const syslogPath = "/var/log/syslog";
    const syslogContent = await fs.readFile(syslogPath, "utf-8");

    logger.info(
      `[machines.ts] Successfully read syslog file (${syslogContent.length} characters)`
    );

    // Set content type to plain text and send the file content
    res.setHeader("Content-Type", "text/plain");
    res.status(200).send(syslogContent);
  } catch (error: any) {
    logger.error("[machines.ts] Error reading syslog file:", error);

    // Handle specific error cases
    if (error.code === "ENOENT") {
      return res.status(404).json({
        error: {
          code: "FILE_NOT_FOUND",
          message: "Syslog file not found",
          details:
            process.env.NODE_ENV !== "production"
              ? "The file /var/log/syslog does not exist"
              : undefined,
          status: 404,
        },
      });
    }

    if (error.code === "EACCES") {
      return res.status(403).json({
        error: {
          code: "PERMISSION_DENIED",
          message: "Permission denied to read syslog file",
          details:
            process.env.NODE_ENV !== "production"
              ? "Insufficient permissions to read /var/log/syslog"
              : undefined,
          status: 403,
        },
      });
    }

    // Generic error for other cases
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to read syslog file",
        details:
          process.env.NODE_ENV !== "production" ? error.message : undefined,
        status: 500,
      },
    });
  }
});

// 🔹 GET /machines/check-nick-systemctl: Get services array from nick-systemctl.csv
router.get(
  "/check-nick-systemctl",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      logger.info(
        "[machines.ts] GET /machines/check-nick-systemctl - Building services array from nick-systemctl.csv"
      );

      const servicesArray = await buildServicesArrayFromNickSystemctl();

      logger.info(
        `[machines.ts] Successfully built services array with ${servicesArray.length} service(s)`
      );

      res.status(200).json({
        message: "Services array built successfully from nick-systemctl.csv",
        servicesArray,
      });
    } catch (error: any) {
      logger.error(
        "[machines.ts] Error in /machines/check-nick-systemctl:",
        error
      );

      // If the error has the standardized format, return it directly
      if (error.error) {
        return res.status(error.error.status || 500).json(error);
      }

      // Otherwise, return a generic internal error
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to build services array",
          details:
            process.env.NODE_ENV !== "production" ? error.message : undefined,
          status: 500,
        },
      });
    }
  }
);

// 🔹 GET /machines: Get all machines
router.get("/", authenticateToken, async (req, res) => {
  logger.info("in GET /machines");

  const existingMachines = await Machine.find();
  // logger.info(existingMachines);

  // Update each machine's properties if necessary
  const updatedMachines = existingMachines.map((machine) => {
    return machine;
  });

  return res.json({ result: true, existingMachines: updatedMachines });
});

// 🔹 POST /machines: Create a new machine
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { urlApiForTsmNetwork, nginxStoragePathOptions, servicesArray } =
      req.body;

    // Validate required fields
    const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
      "urlApiForTsmNetwork",
      "nginxStoragePathOptions",
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

    // Validate that nginxStoragePathOptions is an array
    if (!Array.isArray(nginxStoragePathOptions)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "nginxStoragePathOptions must be an array of strings",
          status: 400,
        },
      });
    }

    // Validate servicesArray if provided
    if (servicesArray !== undefined) {
      if (!Array.isArray(servicesArray)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: "servicesArray must be an array",
            status: 400,
          },
        });
      }

      // Validate each service object
      for (let i = 0; i < servicesArray.length; i++) {
        const service = servicesArray[i];
        const { isValid: serviceValid, missingKeys: serviceMissingKeys } =
          checkBodyReturnMissing(service, ["filename", "pathToLogs"]);

        if (!serviceValid) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: `Service at index ${i} is missing required fields: ${serviceMissingKeys.join(
                ", "
              )}`,
              status: 400,
            },
          });
        }

        // Validate that required fields are strings
        if (
          typeof service.filename !== "string" ||
          typeof service.pathToLogs !== "string"
        ) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: `Service at index ${i}: filename and pathToLogs must be strings`,
              status: 400,
            },
          });
        }

        // Validate optional fields if provided
        if (
          service.filenameTimer !== undefined &&
          typeof service.filenameTimer !== "string"
        ) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: `Service at index ${i}: filenameTimer must be a string`,
              status: 400,
            },
          });
        }

        if (service.port !== undefined && typeof service.port !== "number") {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: `Service at index ${i}: port must be a number`,
              status: 400,
            },
          });
        }

        // Validate service file and populate name and workingDirectory
        try {
          await getServicesNameAndValidateServiceFile(service);
        } catch (error: any) {
          // Return the standardized error from the validation function
          return res.status(error.error?.status || 400).json(error);
        }
      }
    }

    // Get machine name and local IP address from OS
    const { machineName, localIpAddress } = getMachineInfo();

    // Auto-generate publicId
    const publicId = randomUUID();

    // Create the machine document
    const machine = await Machine.create({
      publicId,
      machineName,
      urlApiForTsmNetwork,
      localIpAddress,
      nginxStoragePathOptions,
      servicesArray: servicesArray || [],
    });

    res.status(201).json({
      message: "Machine created successfully",
      machine: {
        publicId: machine.publicId,
        id: machine._id,
        machineName: machine.machineName,
        urlApiForTsmNetwork: machine.urlApiForTsmNetwork,
        localIpAddress: machine.localIpAddress,
        nginxStoragePathOptions: machine.nginxStoragePathOptions,
        servicesArray: machine.servicesArray,
        createdAt: machine.createdAt,
        updatedAt: machine.updatedAt,
      },
    });
  } catch (error: any) {
    logger.error("Error creating machine:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to create machine",
        details:
          process.env.NODE_ENV !== "production" ? error.message : undefined,
        status: 500,
      },
    });
  }
});

// 🔹 PATCH /machines/:publicId: Update a machine
router.patch(
  "/:publicId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { publicId } = req.params;
      logger.info(
        `[machines.ts] PATCH /machines/${publicId} - Request received`
      );

      const { urlApiForTsmNetwork, nginxStoragePathOptions, servicesArray } =
        req.body;
      logger.info(
        `[machines.ts] PATCH /machines/${publicId} - Body fields: urlApiForTsmNetwork=${!!urlApiForTsmNetwork}, nginxStoragePathOptions=${!!nginxStoragePathOptions}, servicesArray=${!!servicesArray}`
      );

      // Validate publicId parameter
      if (!publicId || typeof publicId !== "string" || publicId.trim() === "") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: "publicId parameter must be a non-empty string",
            status: 400,
          },
        });
      }

      // Find the machine by publicId
      const machine = await Machine.findOne({ publicId });
      if (!machine) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Machine not found",
            status: 404,
          },
        });
      }

      // Build update object with only provided fields
      const updates: any = {};

      // Validate and add urlApiForTsmNetwork if provided
      if (urlApiForTsmNetwork !== undefined) {
        if (
          typeof urlApiForTsmNetwork !== "string" ||
          urlApiForTsmNetwork.trim() === ""
        ) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: "urlApiForTsmNetwork must be a non-empty string",
              status: 400,
            },
          });
        }
        updates.urlApiForTsmNetwork = urlApiForTsmNetwork;
      }

      // Validate and add nginxStoragePathOptions if provided
      if (nginxStoragePathOptions !== undefined) {
        if (!Array.isArray(nginxStoragePathOptions)) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: "nginxStoragePathOptions must be an array of strings",
              status: 400,
            },
          });
        }
        updates.nginxStoragePathOptions = nginxStoragePathOptions;
      }

      // Validate and add servicesArray if provided
      if (servicesArray !== undefined) {
        logger.info(
          `[machines.ts] PATCH /machines/${publicId} - Validating servicesArray with ${servicesArray.length} services`
        );

        if (!Array.isArray(servicesArray)) {
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: "servicesArray must be an array",
              status: 400,
            },
          });
        }

        // Validate each service object
        for (let i = 0; i < servicesArray.length; i++) {
          const service = servicesArray[i];
          const { isValid: serviceValid, missingKeys: serviceMissingKeys } =
            checkBodyReturnMissing(service, ["filename", "pathToLogs"]);

          if (!serviceValid) {
            return res.status(400).json({
              error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: `Service at index ${i} is missing required fields: ${serviceMissingKeys.join(
                  ", "
                )}`,
                status: 400,
              },
            });
          }

          // Validate that required fields are strings
          if (
            typeof service.filename !== "string" ||
            typeof service.pathToLogs !== "string"
          ) {
            return res.status(400).json({
              error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: `Service at index ${i}: filename and pathToLogs must be strings`,
                status: 400,
              },
            });
          }

          // Validate optional fields if provided
          if (
            service.filenameTimer !== undefined &&
            typeof service.filenameTimer !== "string"
          ) {
            return res.status(400).json({
              error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: `Service at index ${i}: filenameTimer must be a string`,
                status: 400,
              },
            });
          }

          if (service.port !== undefined && typeof service.port !== "number") {
            return res.status(400).json({
              error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: `Service at index ${i}: port must be a number`,
                status: 400,
              },
            });
          }

          // Validate service file and populate name and workingDirectory
          logger.info(
            `[machines.ts] PATCH /machines/${publicId} - Validating service file ${i}: ${service.filename}`
          );
          try {
            await getServicesNameAndValidateServiceFile(service);
            logger.info(
              `[machines.ts] PATCH /machines/${publicId} - Service ${i} validation successful: ${service.filename}`
            );
          } catch (error: any) {
            logger.info(
              `[machines.ts] PATCH /machines/${publicId} - Service ${i} validation failed:`,
              error
            );
            // Return the standardized error from the validation function
            return res.status(error.error?.status || 400).json(error);
          }
        }

        logger.info(
          `[machines.ts] PATCH /machines/${publicId} - All services validated successfully`
        );
        updates.servicesArray = servicesArray;
      }

      // Check if at least one field is being updated
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details:
              "At least one field must be provided for update (urlApiForTsmNetwork, nginxStoragePathOptions, or servicesArray)",
            status: 400,
          },
        });
      }

      // Update the machine
      logger.info(
        `[machines.ts] PATCH /machines/${publicId} - Updating database with fields: ${Object.keys(
          updates
        ).join(", ")}`
      );
      const updatedMachine = await Machine.findOneAndUpdate(
        { publicId },
        updates,
        { new: true, runValidators: true }
      );

      logger.info(
        `[machines.ts] PATCH /machines/${publicId} - Update successful`
      );
      res.status(200).json({
        message: "Machine updated successfully",
        machine: {
          publicId: updatedMachine!.publicId,
          id: updatedMachine!._id,
          machineName: updatedMachine!.machineName,
          urlApiForTsmNetwork: updatedMachine!.urlApiForTsmNetwork,
          localIpAddress: updatedMachine!.localIpAddress,
          nginxStoragePathOptions: updatedMachine!.nginxStoragePathOptions,
          servicesArray: updatedMachine!.servicesArray,
          createdAt: updatedMachine!.createdAt,
          updatedAt: updatedMachine!.updatedAt,
        },
      });
    } catch (error: any) {
      logger.error("Error updating machine:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update machine",
          details:
            process.env.NODE_ENV !== "production" ? error.message : undefined,
          status: 500,
        },
      });
    }
  }
);

// 🔹 DELETE /machines/:publicId: Delete a machine
router.delete("/:publicId", authenticateToken, async (req, res) => {
  try {
    const { publicId } = req.params;

    // Validate publicId parameter
    if (!publicId || typeof publicId !== "string" || publicId.trim() === "") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "publicId parameter must be a non-empty string",
          status: 400,
        },
      });
    }

    const machine = await Machine.findOneAndDelete({ publicId });
    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found",
          status: 404,
        },
      });
    }

    res.status(200).json({
      message: "Machine deleted successfully",
      deletedMachine: {
        publicId: machine.publicId,
        machineName: machine.machineName,
      },
    });
  } catch (error: any) {
    logger.error("Error deleting machine:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to delete machine",
        details:
          process.env.NODE_ENV !== "production" ? error.message : undefined,
        status: 500,
      },
    });
  }
});

export default router;
