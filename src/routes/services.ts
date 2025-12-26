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
  try {
    // Check if running in production/Ubuntu environment
    if (process.env.NODE_ENV !== "production") {
      return res.status(400).json({
        error:
          "This endpoint only works in production environment on Ubuntu OS",
      });
    }

    // Get current machine info
    const { machineName } = getMachineInfo();

    // Find the machine in the database by machineName
    const machine = await Machine.findOne({ machineName });

    if (!machine) {
      return res.status(404).json({
        error: `Machine with name "${machineName}" not found in database`,
      });
    }

    // Check if machine has servicesArray
    if (!machine.servicesArray || machine.servicesArray.length === 0) {
      return res.status(404).json({
        error: `Machine "${machineName}" has no services configured in servicesArray`,
      });
    }

    // Build servicesStatusArray by querying systemctl for each service
    const servicesStatusArray = await Promise.all(
      machine.servicesArray.map(async (service) => {
        try {
          // Get service status
          const status = await getServiceStatus(service.filename);

          // Base service object
          const serviceStatus: any = {
            name: service.name,
            filename: service.filename,
            status,
          };

          // If service has a timer, get timer status and trigger
          if (service.filenameTimer) {
            try {
              const { timerStatus, timerTrigger } =
                await getTimerStatusAndTrigger(service.filenameTimer);
              serviceStatus.timerStatus = timerStatus;
              serviceStatus.timerTrigger = timerTrigger;
            } catch (error) {
              console.error(
                `Error getting timer status for ${service.filenameTimer}:`,
                error
              );
              // If timer status fails, set as unknown but continue
              serviceStatus.timerStatus = "unknown";
              serviceStatus.timerTrigger = "unknown";
            }
          }

          return serviceStatus;
        } catch (error) {
          console.error(
            `Error getting status for service ${service.filename}:`,
            error
          );
          // Return service with unknown status if systemctl fails
          return {
            name: service.name,
            filename: service.filename,
            status: "unknown",
          };
        }
      })
    );

    res.json({ servicesStatusArray });
  } catch (error) {
    console.error("Error fetching services status:", error);
    res.status(500).json({
      error: "Failed to fetch services status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
