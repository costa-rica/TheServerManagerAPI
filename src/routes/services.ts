import express from "express";
import type { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { authenticateToken } from "../modules/authentication";
import { getMachineInfo } from "../modules/machines";
import { Machine } from "../models/machine";
import {
  getServiceStatus,
  getTimerStatusAndTrigger,
  toggleService,
  readLogFile,
} from "../modules/services";
import {
  getLocalBranches,
  getRemoteBranches,
  gitFetch,
  gitPull,
  gitCheckout,
  getCurrentBranch,
  deleteBranch,
} from "../modules/git";
import { npmInstall, npmBuild } from "../modules/npm";
import {
  generateServiceFile,
  VALID_SERVICE_TEMPLATES,
  VALID_TIMER_TEMPLATES,
  type TemplateVariables,
} from "../modules/systemd";
import logger from "../config/logger";

const execAsync = promisify(exec);

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// 🔹 GET /services: Get all services running on this server
router.get("/", async (req: Request, res: Response) => {
  logger.info("[services route] GET /services - Request received");
  try {
    // Check if running in production/testing/Ubuntu environment
    logger.info(`[services route] NODE_ENV: ${process.env.NODE_ENV}`);
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      logger.warn(
        "[services route] Not in production or testing environment, returning error"
      );
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    logger.info(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      logger.error(
        `[services route] Machine "${machineName}" not found in database`
      );
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found in database",
          details: `Machine with name "${machineName}" not found in database`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Machine found: ${machine.publicId}`);
    logger.info(
      `[services route] Machine has ${
        machine.servicesArray?.length || 0
      } services`
    );

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      logger.warn(
        `[services route] Machine "${machineName}" has no services configured`
      );
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No services configured for this machine",
          details: `Machine "${machineName}" has no services configured in servicesArray`,
          status: 404,
        },
      });
    }

    // Build servicesStatusArray by querying systemctl for each service
    logger.info(
      `[services route] Starting to query status for ${machine.servicesArray.length} services`
    );

    const servicesStatusArray = await Promise.all(
      machine.servicesArray.map(async (service, index) => {
        logger.info(
          `[services route] Processing service ${index + 1}/${
            machine.servicesArray.length
          }: ${service.name} (${service.filename})`
        );
        try {
          // Get service status
          const statusObj = await getServiceStatus(service.filename);
          logger.info(
            `[services route] Got status for ${service.filename}:`,
            statusObj
          );

          // Base service object
          const serviceStatus: any = {
            name: service.name,
            filename: service.filename,
            ...statusObj, // Includes loaded, active, status, onStartStatus
          };

          // If service has a timer, get timer status and trigger
          if (service.filenameTimer) {
            logger.info(
              `[services route] Service has timer: ${service.filenameTimer}`
            );
            try {
              const {
                timerLoaded,
                timerActive,
                timerStatus,
                timerOnStartStatus,
                timerTrigger,
              } = await getTimerStatusAndTrigger(service.filenameTimer);
              serviceStatus.timerLoaded = timerLoaded;
              serviceStatus.timerActive = timerActive;
              serviceStatus.timerStatus = timerStatus;
              serviceStatus.timerOnStartStatus = timerOnStartStatus;
              serviceStatus.timerTrigger = timerTrigger;
              logger.info(
                `[services route] Got timer status for ${service.filenameTimer}`
              );
            } catch (error) {
              logger.error(
                `[services route] Error getting timer status for ${service.filenameTimer}:`,
                error
              );
              // If timer status fails, set as unknown but continue
              serviceStatus.timerLoaded = "unknown";
              serviceStatus.timerActive = "unknown";
              serviceStatus.timerStatus = "unknown";
              serviceStatus.timerOnStartStatus = "unknown";
              serviceStatus.timerTrigger = "unknown";
            }
          }

          logger.info(
            `[services route] Completed processing service: ${service.name}`
          );
          return serviceStatus;
        } catch (error) {
          logger.error(
            `[services route] Error getting status for service ${service.filename}:`,
            error
          );
          logger.error(
            `[services route] Error stack:`,
            error instanceof Error ? error.stack : "N/A"
          );
          // Return service with unknown status if systemctl fails
          return {
            name: service.name,
            filename: service.filename,
            loaded: "unknown",
            active: "unknown",
            status: "unknown",
            onStartStatus: "unknown",
          };
        }
      })
    );

    logger.info(
      `[services route] Completed all service queries, returning ${servicesStatusArray.length} results`
    );
    res.json({ servicesStatusArray });
  } catch (error: any) {
    logger.error("[services route] Unhandled error in GET /services:", error);
    logger.error(
      "[services route] Error stack:",
      error instanceof Error ? error.stack : "N/A"
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch services status",
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

// 🔹 POST /services/control/:serviceFilename/:toggleStatus: Toggle service state
router.post(
  "/control/:serviceFilename/:toggleStatus",
  async (req: Request, res: Response) => {
    logger.info(
      "[services route] POST /services/control/:serviceFilename/:toggleStatus - Request received"
    );
    try {
      const { serviceFilename, toggleStatus } = req.params;
      logger.info(
        `[services route] serviceFilename: ${serviceFilename}, toggleStatus: ${toggleStatus}`
      );

      // Check if running in production/testing/Ubuntu environment
      if (
        process.env.NODE_ENV !== "production" &&
        process.env.NODE_ENV !== "testing"
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "This endpoint only works in production or testing environment on Ubuntu OS",
            status: 400,
          },
        });
      }

      // Validate toggleStatus
      const validActions = [
        "start",
        "stop",
        "restart",
        "reload",
        "enable",
        "disable",
      ];
      if (!validActions.includes(toggleStatus)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid toggleStatus",
            details: `Invalid toggleStatus. Must be one of: ${validActions.join(
              ", "
            )}`,
            status: 400,
          },
        });
      }

      // Get current machine info
      const { machineName } = getMachineInfo();
      logger.info(`[services route] Machine name from OS: ${machineName}`);

      // Find the machine in the database by machineName
      const machine = await Machine.findOne({ machineName });

      if (!machine) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Machine not found in database",
            details: `Machine with name "${machineName}" not found in database`,
            status: 404,
          },
        });
      }

      logger.info(`[services route] Machine found: ${machine.publicId}`);

      // Check if machine has servicesArray
      if (!machine.servicesArray || machine.servicesArray.length === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "No services configured for this machine",
            details: `Machine "${machineName}" has no services configured in servicesArray`,
            status: 404,
          },
        });
      }

      // Find the service in the servicesArray by filename or filenameTimer
      const service = machine.servicesArray.find(
        (s) =>
          s.filename === serviceFilename || s.filenameTimer === serviceFilename
      );

      if (!service) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Service not found",
            details: `Service with filename "${serviceFilename}" is not configured in this machine's servicesArray`,
            status: 404,
          },
        });
      }

      logger.info(`[services route] Found service: ${service.name}`);

      // Special handling for tsm-api.service and tsm-nextjs.service
      // These critical services should always restart instead of start/stop to ensure proper state
      let actualToggleAction = toggleStatus;
      if (
        (serviceFilename === "tsm-api.service" ||
          serviceFilename === "tsm-nextjs.service") &&
        (toggleStatus === "start" ||
          toggleStatus === "stop" ||
          toggleStatus === "restart")
      ) {
        actualToggleAction = "restart";
        if (toggleStatus !== "restart") {
          logger.info(
            `[services route] Overriding ${toggleStatus} to restart for ${serviceFilename}`
          );
        }
      }

      // Execute the toggle command
      const toggleResult = await toggleService(
        actualToggleAction,
        serviceFilename
      );

      if (!toggleResult.success) {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: `Failed to ${actualToggleAction} service`,
            details:
              process.env.NODE_ENV !== "production"
                ? toggleResult.error
                : undefined,
            status: 500,
          },
        });
      }

      logger.info(
        `[services route] Successfully executed ${actualToggleAction} on ${serviceFilename}`
      );

      // Get updated service status
      const statusObj = await getServiceStatus(serviceFilename);

      // Build response object
      const serviceStatus: any = {
        name: service.name,
        filename: service.filename,
        ...statusObj, // Includes loaded, active, status, onStartStatus
      };

      // If service has a timer, get timer status and trigger
      if (service.filenameTimer) {
        try {
          const {
            timerLoaded,
            timerActive,
            timerStatus,
            timerOnStartStatus,
            timerTrigger,
          } = await getTimerStatusAndTrigger(service.filenameTimer);
          serviceStatus.timerLoaded = timerLoaded;
          serviceStatus.timerActive = timerActive;
          serviceStatus.timerStatus = timerStatus;
          serviceStatus.timerOnStartStatus = timerOnStartStatus;
          serviceStatus.timerTrigger = timerTrigger;
        } catch (error) {
          logger.error(`[services route] Error getting timer status:`, error);
          serviceStatus.timerLoaded = "unknown";
          serviceStatus.timerActive = "unknown";
          serviceStatus.timerStatus = "unknown";
          serviceStatus.timerOnStartStatus = "unknown";
          serviceStatus.timerTrigger = "unknown";
        }
      }

      logger.info(`[services route] Returning updated service status`);
      res.json(serviceStatus);
    } catch (error: any) {
      logger.error(
        "[services route] Unhandled error in POST /services/control/:serviceFilename/:toggleStatus:",
        error
      );
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to toggle service",
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

// 🔹 GET /services/logs/:name: Get log file for a service
router.get("/logs/:name", async (req: Request, res: Response) => {
  logger.info("[services route] GET /services/logs/:name - Request received");
  try {
    const { name } = req.params;
    logger.info(`[services route] Log requested for service name: ${name}`);

    // Check if running in production/testing/Ubuntu environment
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    logger.info(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found in database",
          details: `Machine with name "${machineName}" not found in database`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Machine found: ${machine.publicId}`);

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No services configured for this machine",
          details: `Machine "${machineName}" has no services configured in servicesArray`,
          status: 404,
        },
      });
    }

    // Find the service in the servicesArray by name
    const service = machine.servicesArray.find((s) => s.name === name);

    if (!service) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Service not found",
          details: `Service with name "${name}" is not configured in this machine's servicesArray`,
          status: 404,
        },
      });
    }

    logger.info(
      `[services route] Found service: ${service.name}, pathToLogs: ${service.pathToLogs}`
    );

    // Read the log file
    const logResult = await readLogFile(service.pathToLogs, name);

    if (!logResult.success) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Log file not found or could not be read",
          details: logResult.error,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Successfully read log file for ${name}`);

    // Return log content as plain text
    res.set("Content-Type", "text/plain");
    res.send(logResult.content);
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in GET /services/logs/:name:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to read log file",
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

// 🔹 GET /services/git/:name: Get remote branches for a service's git repository
router.get("/git/:name", async (req: Request, res: Response) => {
  logger.info("[services route] GET /services/git/:name - Request received");
  try {
    const { name } = req.params;
    logger.info(`[services route] Git branches requested for service: ${name}`);

    // Check if running in production/testing/Ubuntu environment
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    logger.info(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found in database",
          details: `Machine with name "${machineName}" not found in database`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Machine found: ${machine.publicId}`);

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No services configured for this machine",
          details: `Machine "${machineName}" has no services configured in servicesArray`,
          status: 404,
        },
      });
    }

    // Find the service in the servicesArray by name
    const service = machine.servicesArray.find((s) => s.name === name);

    if (!service) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Service not found",
          details: `Service with name "${name}" is not configured in this machine's servicesArray`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Found service: ${service.name}`);

    // Get remote branches
    const branchesResult = await getLocalBranches(name);

    if (!branchesResult.success) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get remote branches",
          details:
            process.env.NODE_ENV !== "production"
              ? branchesResult.error
              : undefined,
          status: 500,
        },
      });
    }

    // Get current branch
    const currentBranchResult = await getCurrentBranch(name);

    if (!currentBranchResult.success) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get current branch",
          details:
            process.env.NODE_ENV !== "production"
              ? currentBranchResult.error
              : undefined,
          status: 500,
        },
      });
    }

    // Get remote branches
    const remoteBranchesResult = await getRemoteBranches(name);

    if (!remoteBranchesResult.success) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get remote branches",
          details:
            process.env.NODE_ENV !== "production"
              ? remoteBranchesResult.error
              : undefined,
          status: 500,
        },
      });
    }

    logger.info(
      `[services route] Successfully retrieved ${branchesResult.branches.length} local branches, ${remoteBranchesResult.branches.length} remote branches, and current branch: ${currentBranchResult.currentBranch}`
    );
    res.json({
      gitBranchesLocalArray: branchesResult.branches,
      gitBranchesRemoteArray: remoteBranchesResult.branches,
      currentBranch: currentBranchResult.currentBranch,
    });
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in GET /services/git/:name:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get remote branches",
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

// 🔹 POST /services/git/:name/:action: Execute git fetch or pull
router.post("/git/:name/:action", async (req: Request, res: Response) => {
  logger.info(
    "[services route] POST /services/git/:name/:action - Request received"
  );
  try {
    const { name, action } = req.params;
    logger.info(
      `[services route] Git action "${action}" requested for service: ${name}`
    );

    // Check if running in production/testing/Ubuntu environment
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Validate action
    const validActions = ["fetch", "pull"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid action",
          details: `Invalid action. Must be one of: ${validActions.join(", ")}`,
          status: 400,
        },
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    logger.info(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found in database",
          details: `Machine with name "${machineName}" not found in database`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Machine found: ${machine.publicId}`);

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No services configured for this machine",
          details: `Machine "${machineName}" has no services configured in servicesArray`,
          status: 404,
        },
      });
    }

    // Find the service in the servicesArray by name
    const service = machine.servicesArray.find((s) => s.name === name);

    if (!service) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Service not found",
          details: `Service with name "${name}" is not configured in this machine's servicesArray`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Found service: ${service.name}`);

    // Execute git action
    const result =
      action === "fetch" ? await gitFetch(name) : await gitPull(name);

    if (!result.success) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: `Failed to execute git ${action}`,
          details:
            process.env.NODE_ENV !== "production" ? result.error : undefined,
          status: 500,
        },
      });
    }

    logger.info(`[services route] Successfully executed git ${action}`);
    res.json({
      success: true,
      action,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in POST /services/git/:name/:action:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to execute git action",
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

// 🔹 POST /services/git/checkout/:name/:branchName: Checkout a branch
router.post(
  "/git/checkout/:name/:branchName",
  async (req: Request, res: Response) => {
    logger.info(
      "[services route] POST /services/git/checkout/:name/:branchName - Request received"
    );
    try {
      const { name, branchName } = req.params;
      logger.info(
        `[services route] Git checkout "${branchName}" requested for service: ${name}`
      );

      // Check if running in production/testing/Ubuntu environment
      if (
        process.env.NODE_ENV !== "production" &&
        process.env.NODE_ENV !== "testing"
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "This endpoint only works in production or testing environment on Ubuntu OS",
            status: 400,
          },
        });
      }

      // Get current machine info
      const { machineName } = getMachineInfo();
      logger.info(`[services route] Machine name from OS: ${machineName}`);

      // Find the machine in the database by machineName
      const machine = await Machine.findOne({ machineName });

      if (!machine) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Machine not found in database",
            details: `Machine with name "${machineName}" not found in database`,
            status: 404,
          },
        });
      }

      logger.info(`[services route] Machine found: ${machine.publicId}`);

      // Check if machine has servicesArray
      if (!machine.servicesArray || machine.servicesArray.length === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "No services configured for this machine",
            details: `Machine "${machineName}" has no services configured in servicesArray`,
            status: 404,
          },
        });
      }

      // Find the service in the servicesArray by name
      const service = machine.servicesArray.find((s) => s.name === name);

      if (!service) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Service not found",
            details: `Service with name "${name}" is not configured in this machine's servicesArray`,
            status: 404,
          },
        });
      }

      logger.info(`[services route] Found service: ${service.name}`);

      // Execute git checkout
      const result = await gitCheckout(name, branchName);

      if (!result.success) {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: `Failed to checkout branch "${branchName}"`,
            details:
              process.env.NODE_ENV !== "production" ? result.error : undefined,
            status: 500,
          },
        });
      }

      logger.info(
        `[services route] Successfully checked out branch: ${branchName}`
      );
      res.json({
        success: true,
        branchName,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (error: any) {
      logger.error(
        "[services route] Unhandled error in POST /services/git/checkout/:name/:branchName:",
        error
      );
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to checkout branch",
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

// 🔹 DELETE /services/git/delete-branch/:name/:branchName: Delete a branch
router.delete(
  "/git/delete-branch/:name/:branchName",
  async (req: Request, res: Response) => {
    logger.info(
      "[services route] DELETE /services/git/delete-branch/:name/:branchName - Request received"
    );
    try {
      const { name, branchName } = req.params;
      logger.info(
        `[services route] Delete branch "${branchName}" requested for service: ${name}`
      );

      // Check if running in production/testing/Ubuntu environment
      if (
        process.env.NODE_ENV !== "production" &&
        process.env.NODE_ENV !== "testing"
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "This endpoint only works in production or testing environment on Ubuntu OS",
            status: 400,
          },
        });
      }

      // Get current machine info
      const { machineName } = getMachineInfo();
      logger.info(`[services route] Machine name from OS: ${machineName}`);

      // Find the machine in the database by machineName
      const machine = await Machine.findOne({ machineName });

      if (!machine) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Machine not found in database",
            details: `Machine with name "${machineName}" not found in database`,
            status: 404,
          },
        });
      }

      logger.info(`[services route] Machine found: ${machine.publicId}`);

      // Check if machine has servicesArray
      if (!machine.servicesArray || machine.servicesArray.length === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "No services configured for this machine",
            details: `Machine "${machineName}" has no services configured in servicesArray`,
            status: 404,
          },
        });
      }

      // Find the service in the servicesArray by name
      const service = machine.servicesArray.find((s) => s.name === name);

      if (!service) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Service not found",
            details: `Service with name "${name}" is not configured in this machine's servicesArray`,
            status: 404,
          },
        });
      }

      logger.info(`[services route] Found service: ${service.name}`);

      // Execute git branch -D
      const result = await deleteBranch(name, branchName);

      if (!result.success) {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: `Failed to delete branch "${branchName}"`,
            details:
              process.env.NODE_ENV !== "production" ? result.error : undefined,
            status: 500,
          },
        });
      }

      logger.info(
        `[services route] Successfully deleted branch: ${branchName}`
      );
      res.json({
        success: true,
        branchName,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (error: any) {
      logger.error(
        "[services route] Unhandled error in DELETE /services/git/delete-branch/:name/:branchName:",
        error
      );
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete branch",
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

// 🔹 POST /services/npm/:name/:action: Execute npm install or build
router.post("/npm/:name/:action", async (req: Request, res: Response) => {
  logger.info(
    "[services route] POST /services/npm/:name/:action - Request received"
  );
  try {
    const { name, action } = req.params;
    logger.info(
      `[services route] npm ${action} requested for service: ${name}`
    );

    // Check if running in production/testing/Ubuntu environment
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Validate action
    const validActions = ["install", "build"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid action",
          details: `Invalid action. Must be one of: ${validActions.join(", ")}`,
          status: 400,
        },
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    logger.info(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found in database",
          details: `Machine with name "${machineName}" not found in database`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Machine found: ${machine.publicId}`);

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No services configured for this machine",
          details: `Machine "${machineName}" has no services configured in servicesArray`,
          status: 404,
        },
      });
    }

    // Find the service in the servicesArray by name
    const service = machine.servicesArray.find((s) => s.name === name);

    if (!service) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Service not found",
          details: `Service with name "${name}" is not configured in this machine's servicesArray`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Found service: ${service.name}`);

    // Execute npm action
    const result =
      action === "install" ? await npmInstall(name) : await npmBuild(name);

    logger.info(
      `[services route] npm ${action} completed with status: ${result.status}`
    );

    res.json({
      status: result.status,
      warnings: result.warnings,
      failureReason: result.failureReason,
    });
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in POST /services/npm/:name/:action:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to execute npm command",
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

// 🔹 POST /services/make-service-file: Generate systemd service and timer files
router.post("/make-service-file", async (req: Request, res: Response) => {
  logger.info(
    "[services route] POST /services/make-service-file - Request received"
  );
  try {
    const { filenameServiceTemplate, filenameTimerTemplate, variables } =
      req.body;

    // Validate required fields
    if (!filenameServiceTemplate) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "Missing required field: filenameServiceTemplate",
          status: 400,
        },
      });
    }

    if (!variables || typeof variables !== "object") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "Missing or invalid 'variables' object",
          status: 400,
        },
      });
    }

    if (!variables.project_name) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "Missing required field in variables: project_name",
          status: 400,
        },
      });
    }

    // Validate filenameServiceTemplate is a valid template
    if (!VALID_SERVICE_TEMPLATES.includes(filenameServiceTemplate as any)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid service template",
          details: `filenameServiceTemplate must be one of: ${VALID_SERVICE_TEMPLATES.join(
            ", "
          )}`,
          status: 400,
        },
      });
    }

    // Validate filenameTimerTemplate if provided
    if (
      filenameTimerTemplate &&
      !VALID_TIMER_TEMPLATES.includes(filenameTimerTemplate as any)
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid timer template",
          details: `filenameTimerTemplate must be one of: ${VALID_TIMER_TEMPLATES.join(
            ", "
          )}`,
          status: 400,
        },
      });
    }

    // Get PATH_TO_SERVICE_FILES from environment
    const outputDirectory = process.env.PATH_TO_SERVICE_FILES;
    if (!outputDirectory) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Server configuration error",
          details: "PATH_TO_SERVICE_FILES environment variable is not set",
          status: 500,
        },
      });
    }

    // Auto-generate project_name_lowercase from project_name
    const project_name_lowercase = variables.project_name.toLowerCase();

    // Prepare complete variables object
    const completeVariables: TemplateVariables = {
      project_name: variables.project_name,
      project_name_lowercase,
      python_env_name: variables.python_env_name,
      port: variables.port,
    };

    logger.info(
      `[services route] Generating service file for project: ${variables.project_name}`
    );
    logger.info(`[services route] Using template: ${filenameServiceTemplate}`);
    logger.info(
      `[services route] Timer template: ${filenameTimerTemplate || "none"}`
    );

    // Generate the service file
    const serviceFilename = `${project_name_lowercase}.service`;
    const serviceResult = await generateServiceFile(
      filenameServiceTemplate,
      completeVariables,
      outputDirectory,
      serviceFilename
    );

    logger.info(
      `[services route] Service file created: ${serviceResult.outputPath}`
    );

    // Generate the timer file if requested
    let timerResult: { outputPath: string; content: string } | null = null;
    if (filenameTimerTemplate) {
      const timerFilename = `${project_name_lowercase}.timer`;
      timerResult = await generateServiceFile(
        filenameTimerTemplate,
        completeVariables,
        outputDirectory,
        timerFilename
      );
      logger.info(
        `[services route] Timer file created: ${timerResult.outputPath}`
      );
    }

    // Build response
    const response: any = {
      message: "Service file(s) created successfully",
      service: {
        template: filenameServiceTemplate,
        outputPath: serviceResult.outputPath,
        filename: serviceFilename,
        content: serviceResult.content,
      },
      variablesApplied: completeVariables,
    };

    if (timerResult) {
      response.timer = {
        template: filenameTimerTemplate,
        outputPath: timerResult.outputPath,
        filename: `${project_name_lowercase}.timer`,
        content: timerResult.content,
      };
    }

    res.status(201).json(response);
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in POST /services/make-service-file:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate service file(s)",
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

// 🔹 GET /services/service-file/:filename: Read service and/or timer file contents
router.get("/service-file/:filename", async (req: Request, res: Response) => {
  logger.info(
    "[services route] GET /services/service-file/:filename - Request received"
  );
  try {
    const { filename } = req.params;
    logger.info(`[services route] Requested filename: ${filename}`);

    // Check if running in production/testing/Ubuntu environment
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Get PATH_TO_SERVICE_FILES from environment
    const serviceFilesPath = process.env.PATH_TO_SERVICE_FILES;
    if (!serviceFilesPath) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Server configuration error",
          details: "PATH_TO_SERVICE_FILES environment variable is not set",
          status: 500,
        },
      });
    }

    // Parse filename to get base name (split on period)
    const parts = filename.split(".");
    if (parts.length < 2) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid filename format",
          details:
            "Filename must include extension (e.g., app.service or app.timer)",
          status: 400,
        },
      });
    }

    // Get base name (everything before the last period)
    const baseName = parts.slice(0, -1).join(".");
    const filenameService = `${baseName}.service`;
    const filenameTimer = `${baseName}.timer`;

    logger.info(`[services route] Base name: ${baseName}`);
    logger.info(
      `[services route] Will search for: ${filenameService} and ${filenameTimer}`
    );

    // Try to read both service and timer files using sudo cat
    let fileContentService: string | null = null;
    let fileContentTimer: string | null = null;

    // Read .service file
    try {
      const serviceFilePath = path.join(serviceFilesPath, filenameService);
      const command = `sudo cat "${serviceFilePath}"`;
      logger.info(`[services route] Executing: ${command}`);
      const { stdout } = await execAsync(command);
      fileContentService = stdout;
      logger.info(`[services route] Successfully read ${filenameService}`);
    } catch (error: any) {
      logger.warn(
        `[services route] Could not read ${filenameService}: ${error.message}`
      );
    }

    // Read .timer file
    try {
      const timerFilePath = path.join(serviceFilesPath, filenameTimer);
      const command = `sudo cat "${timerFilePath}"`;
      logger.info(`[services route] Executing: ${command}`);
      const { stdout } = await execAsync(command);
      fileContentTimer = stdout;
      logger.info(`[services route] Successfully read ${filenameTimer}`);
    } catch (error: any) {
      logger.warn(
        `[services route] Could not read ${filenameTimer}: ${error.message}`
      );
    }

    // If neither file was found, return error
    if (fileContentService === null && fileContentTimer === null) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Service files not found",
          details: `Neither ${filenameService} nor ${filenameTimer} found in ${serviceFilesPath}`,
          status: 404,
        },
      });
    }

    // Return success with whatever files were found
    logger.info(`[services route] Returning service file contents`);
    res.json({
      status: "success",
      filenameService,
      filenameTimer,
      fileContentService,
      fileContentTimer,
    });
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in GET /services/service-file/:filename:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to read service file(s)",
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

// 🔹 POST /services/service-file/:filename: Update a service or timer file
router.post("/service-file/:filename", async (req: Request, res: Response) => {
  logger.info(
    "[services route] POST /services/service-file/:filename - Request received"
  );
  try {
    const { filename } = req.params;
    const { fileContents } = req.body;

    logger.info(`[services route] Filename to update: ${filename}`);

    // Check if running in production/testing/Ubuntu environment
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Validate fileContents is provided
    if (!fileContents || typeof fileContents !== "string") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "Missing or invalid 'fileContents' in request body",
          status: 400,
        },
      });
    }

    // Get PATH_TO_SERVICE_FILES from environment
    const serviceFilesPath = process.env.PATH_TO_SERVICE_FILES;
    if (!serviceFilesPath) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Server configuration error",
          details: "PATH_TO_SERVICE_FILES environment variable is not set",
          status: 500,
        },
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    logger.info(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found in database",
          details: `Machine with name "${machineName}" not found in database`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Machine found: ${machine.publicId}`);

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No services configured for this machine",
          details: `Machine "${machineName}" has no services configured in servicesArray`,
          status: 404,
        },
      });
    }

    // Validate that filename matches a service in servicesArray
    const isValidFile = machine.servicesArray.some(
      (service) =>
        service.filename === filename || service.filenameTimer === filename
    );

    if (!isValidFile) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Service file not configured for this machine",
          details: `File "${filename}" is not in this machine's servicesArray`,
          status: 400,
        },
      });
    }

    logger.info(
      `[services route] Filename ${filename} validated in servicesArray`
    );

    // Check if file exists in PATH_TO_SERVICE_FILES before allowing update
    const targetFilePath = path.join(serviceFilesPath, filename);
    try {
      const checkCommand = `sudo cat "${targetFilePath}"`;
      logger.info(`[services route] Checking if file exists: ${checkCommand}`);
      await execAsync(checkCommand);
      logger.info(`[services route] File exists: ${targetFilePath}`);
    } catch (error: any) {
      logger.error(`[services route] File does not exist: ${targetFilePath}`);
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Service file not found",
          details: `File "${filename}" does not exist in ${serviceFilesPath}`,
          status: 404,
        },
      });
    }

    // Write file to /home/nick/ first
    const tmpPath = `/home/nick/${filename}`;
    logger.info(`[services route] Writing temporary file to: ${tmpPath}`);
    await fs.writeFile(tmpPath, fileContents, "utf-8");
    logger.info(
      `[services route] Successfully wrote temporary file: ${tmpPath}`
    );

    // Use sudo mv to move the file to the system directory
    const mvCommand = `sudo mv "${tmpPath}" "${serviceFilesPath}/"`;
    logger.info(`[services route] Executing: ${mvCommand}`);

    try {
      const { stdout, stderr } = await execAsync(mvCommand);
      if (stderr) {
        logger.warn(`[services route] mv stderr: ${stderr}`);
      }
      if (stdout) {
        logger.info(`[services route] mv stdout: ${stdout}`);
      }
      logger.info(
        `[services route] Successfully updated file: ${targetFilePath}`
      );
    } catch (error: any) {
      logger.error(
        `[services route] Error moving file with sudo mv: ${error.message}`
      );
      if (error.stderr) {
        logger.error(`[services route] stderr: ${error.stderr}`);
      }
      throw new Error(`Failed to move file to ${serviceFilesPath}`);
    }

    res.json({
      status: "success",
      message: "Service file updated successfully",
      filename,
    });
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in POST /services/service-file/:filename:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update service file",
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

// 🔹 GET /services/env-file/:name: Read .env and .env.local file contents
router.get("/env-file/:name", async (req: Request, res: Response) => {
  logger.info("[services route] GET /services/env-file/:name - Request received");
  try {
    const { name } = req.params;
    logger.info(`[services route] Env file requested for service name: ${name}`);

    // Check if running in production/testing/Ubuntu environment
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    logger.info(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found in database",
          details: `Machine with name "${machineName}" not found in database`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Machine found: ${machine.publicId}`);

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No services configured for this machine",
          details: `Machine "${machineName}" has no services configured in servicesArray`,
          status: 404,
        },
      });
    }

    // Find the service in the servicesArray by name
    const service = machine.servicesArray.find((s) => s.name === name);

    if (!service) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Service not found",
          details: `Service with name "${name}" not found in machine's servicesArray`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Service found: ${service.name}`);

    // Check if service has workingDirectory configured
    if (!service.workingDirectory) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Working directory not configured",
          details: `Service "${name}" does not have workingDirectory configured in servicesArray`,
          status: 400,
        },
      });
    }

    logger.info(`[services route] Working directory: ${service.workingDirectory}`);

    // Initialize response variables
    let env: string | null = null;
    let envStatus = false;
    let envLocal: string | null = null;
    let envLocalStatus = false;

    // Try to read .env file
    try {
      const envPath = path.join(service.workingDirectory, ".env");
      logger.info(`[services route] Attempting to read: ${envPath}`);
      env = await fs.readFile(envPath, "utf-8");
      envStatus = true;
      logger.info(`[services route] Successfully read .env file`);
    } catch (error: any) {
      logger.info(`[services route] Could not read .env file: ${error.message}`);
    }

    // Try to read .env.local file
    try {
      const envLocalPath = path.join(service.workingDirectory, ".env.local");
      logger.info(`[services route] Attempting to read: ${envLocalPath}`);
      envLocal = await fs.readFile(envLocalPath, "utf-8");
      envLocalStatus = true;
      logger.info(`[services route] Successfully read .env.local file`);
    } catch (error: any) {
      logger.info(`[services route] Could not read .env.local file: ${error.message}`);
    }

    // Return success with whatever files were found (can all be null)
    logger.info(`[services route] Returning env file contents`);
    res.json({
      status: "success",
      env,
      envStatus,
      envLocal,
      envLocalStatus,
      workingDirectory: service.workingDirectory,
    });
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in GET /services/env-file/:name:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to read env file(s)",
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

// 🔹 POST /services/env-file/:name: Update .env and/or .env.local file contents
router.post("/env-file/:name", async (req: Request, res: Response) => {
  logger.info("[services route] POST /services/env-file/:name - Request received");
  try {
    const { name } = req.params;
    const { env, envLocal } = req.body;

    logger.info(`[services route] Env file update requested for service name: ${name}`);

    // Check if running in production/testing/Ubuntu environment
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "testing"
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "This endpoint only works in production or testing environment on Ubuntu OS",
          status: 400,
        },
      });
    }

    // Validate that at least one file content is provided
    if (env === undefined && envLocal === undefined) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: "At least one of 'env' or 'envLocal' must be provided in request body",
          status: 400,
        },
      });
    }

    // Validate env content if provided
    if (env !== undefined && env !== null) {
      if (typeof env !== "string") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: "'env' must be a string",
            status: 400,
          },
        });
      }

      // Validate characters - allow: a-z A-Z 0-9 _ = # . - : / " ' @ space newline tab \r
      const allowedPattern = /^[a-zA-Z0-9_=#.\-:/"' @\n\r\t]*$/;
      if (!allowedPattern.test(env)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid characters in .env file content",
            details: "Only alphanumeric and these special characters are allowed: _ = # . - : / \" ' @ space newline tab",
            status: 400,
          },
        });
      }
    }

    // Validate envLocal content if provided
    if (envLocal !== undefined && envLocal !== null) {
      if (typeof envLocal !== "string") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: "'envLocal' must be a string",
            status: 400,
          },
        });
      }

      // Validate characters - allow: a-z A-Z 0-9 _ = # . - : / " ' @ space newline tab \r
      const allowedPattern = /^[a-zA-Z0-9_=#.\-:/"' @\n\r\t]*$/;
      if (!allowedPattern.test(envLocal)) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid characters in .env.local file content",
            details: "Only alphanumeric and these special characters are allowed: _ = # . - : / \" ' @ space newline tab",
            status: 400,
          },
        });
      }
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    logger.info(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Machine not found in database",
          details: `Machine with name "${machineName}" not found in database`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Machine found: ${machine.publicId}`);

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No services configured for this machine",
          details: `Machine "${machineName}" has no services configured in servicesArray`,
          status: 404,
        },
      });
    }

    // Find the service in the servicesArray by name
    const service = machine.servicesArray.find((s) => s.name === name);

    if (!service) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Service not found",
          details: `Service with name "${name}" not found in machine's servicesArray`,
          status: 404,
        },
      });
    }

    logger.info(`[services route] Service found: ${service.name}`);

    // Check if service has workingDirectory configured
    if (!service.workingDirectory) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Working directory not configured",
          details: `Service "${name}" does not have workingDirectory configured in servicesArray`,
          status: 400,
        },
      });
    }

    logger.info(`[services route] Working directory: ${service.workingDirectory}`);

    // Initialize tracking for what was written
    let envWritten = false;
    let envLocalWritten = false;

    // Write .env file if provided
    if (env !== undefined && env !== null) {
      try {
        const envPath = path.join(service.workingDirectory, ".env");
        logger.info(`[services route] Writing to: ${envPath}`);
        await fs.writeFile(envPath, env, "utf-8");
        envWritten = true;
        logger.info(`[services route] Successfully wrote .env file`);
      } catch (error: any) {
        logger.error(`[services route] Failed to write .env file: ${error.message}`);
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to write .env file",
            details:
              process.env.NODE_ENV !== "production" ? error.message : undefined,
            status: 500,
          },
        });
      }
    }

    // Write .env.local file if provided
    if (envLocal !== undefined && envLocal !== null) {
      try {
        const envLocalPath = path.join(service.workingDirectory, ".env.local");
        logger.info(`[services route] Writing to: ${envLocalPath}`);
        await fs.writeFile(envLocalPath, envLocal, "utf-8");
        envLocalWritten = true;
        logger.info(`[services route] Successfully wrote .env.local file`);
      } catch (error: any) {
        logger.error(`[services route] Failed to write .env.local file: ${error.message}`);
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to write .env.local file",
            details:
              process.env.NODE_ENV !== "production" ? error.message : undefined,
            status: 500,
          },
        });
      }
    }

    // Return success
    logger.info(`[services route] Env file(s) updated successfully`);
    res.json({
      status: "success",
      message: "Env file(s) updated successfully",
      envWritten,
      envLocalWritten,
      workingDirectory: service.workingDirectory,
    });
  } catch (error: any) {
    logger.error(
      "[services route] Unhandled error in POST /services/env-file/:name:",
      error
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to update env file(s)",
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
