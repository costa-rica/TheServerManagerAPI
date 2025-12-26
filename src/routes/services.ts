import express from "express";
import type { Request, Response } from "express";
import { authenticateToken } from "../modules/authentication";
import { getMachineInfo } from "../modules/machines";
import { Machine } from "../models/machine";
import {
  getServiceStatus,
  getTimerStatusAndTrigger,
} from "../modules/services";

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// 🔹 GET /services: Get all services running on this server
router.get("/", async (req: Request, res: Response) => {
  console.log("[services route] GET /services - Request received");
  try {
    // Check if running in production/Ubuntu environment
    console.log(`[services route] NODE_ENV: ${process.env.NODE_ENV}`);
    if (process.env.NODE_ENV !== "production") {
      console.warn("[services route] Not in production environment, returning error");
      return res.status(400).json({
        error:
          "This endpoint only works in production environment on Ubuntu OS",
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();
    console.log(`[services route] Machine name from OS: ${machineName}`);

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      console.error(`[services route] Machine "${machineName}" not found in database`);
      return res.status(404).json({
        error: `Machine with name "${machineName}" not found in database`,
      });
    }

    console.log(`[services route] Machine found: ${machine.publicId}`);
    console.log(`[services route] Machine has ${machine.servicesArray?.length || 0} services`);

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      console.warn(`[services route] Machine "${machineName}" has no services configured`);
      return res.status(404).json({
        error: `Machine "${machineName}" has no services configured in servicesArray`,
      });
    }

    // Build servicesStatusArray by querying systemctl for each service
    console.log(`[services route] Starting to query status for ${machine.servicesArray.length} services`);

    const servicesStatusArray = await Promise.all(
      machine.servicesArray.map(async (service, index) => {
        console.log(`[services route] Processing service ${index + 1}/${machine.servicesArray.length}: ${service.name} (${service.filename})`);
        try {
          // Get service status
          const status = await getServiceStatus(service.filename);
          console.log(`[services route] Got status for ${service.filename}: ${status}`);

          // Base service object
          const serviceStatus: any = {
            name: service.name,
            filename: service.filename,
            status,
          };

          // If service has a timer, get timer status and trigger
          if (service.filenameTimer) {
            console.log(`[services route] Service has timer: ${service.filenameTimer}`);
            try {
              const { timerStatus, timerTrigger } =
                await getTimerStatusAndTrigger(service.filenameTimer);
              serviceStatus.timerStatus = timerStatus;
              serviceStatus.timerTrigger = timerTrigger;
              console.log(`[services route] Got timer status for ${service.filenameTimer}`);
            } catch (error) {
              console.error(
                `[services route] Error getting timer status for ${service.filenameTimer}:`,
                error
              );
              // If timer status fails, set as unknown but continue
              serviceStatus.timerStatus = "unknown";
              serviceStatus.timerTrigger = "unknown";
            }
          }

          console.log(`[services route] Completed processing service: ${service.name}`);
          return serviceStatus;
        } catch (error) {
          console.error(
            `[services route] Error getting status for service ${service.filename}:`,
            error
          );
          console.error(`[services route] Error stack:`, error instanceof Error ? error.stack : 'N/A');
          // Return service with unknown status if systemctl fails
          return {
            name: service.name,
            filename: service.filename,
            status: "unknown",
          };
        }
      })
    );

    console.log(`[services route] Completed all service queries, returning ${servicesStatusArray.length} results`);
    res.json({ servicesStatusArray });
  } catch (error) {
    console.error("[services route] Unhandled error in GET /services:", error);
    console.error("[services route] Error stack:", error instanceof Error ? error.stack : 'N/A');
    res.status(500).json({
      error: "Failed to fetch services status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
