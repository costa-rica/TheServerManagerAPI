import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { Machine } from "../models/machine";
import { checkBodyReturnMissing } from "../modules/common";
import { getMachineInfo } from "../modules/machines";
import { authenticateToken } from "../modules/authentication";

const router = express.Router();

// 🔹 GET /machines/name: Get machine name and local IP address
router.get("/name", authenticateToken, (req: Request, res: Response) => {
  try {
    const machineInfo = getMachineInfo();
    res.json(machineInfo);
  } catch (error) {
    console.error("Error getting machine info:", error);
    res.status(500).json({ error: "Failed to retrieve machine information" });
  }
});

// 🔹 GET /machines: Get all machines
router.get("/", authenticateToken, async (req, res) => {
  console.log("in GET /machines");

  const existingMachines = await Machine.find();
  // console.log(existingMachines);

  // Update each machine's properties if necessary
  const updatedMachines = existingMachines.map((machine) => {
    return machine;
  });

  return res.json({ result: true, existingMachines: updatedMachines });
});

// 🔹 POST /machines: Create a new machine
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { urlFor404Api, nginxStoragePathOptions, servicesArray } = req.body;

    // Validate required fields
    const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
      "urlFor404Api",
      "nginxStoragePathOptions",
    ]);

    if (!isValid) {
      return res
        .status(400)
        .json({ error: `Missing ${missingKeys.join(", ")}` });
    }

    // Validate that nginxStoragePathOptions is an array
    if (!Array.isArray(nginxStoragePathOptions)) {
      return res.status(400).json({
        error: "nginxStoragePathOptions must be an array of strings",
      });
    }

    // Validate servicesArray if provided
    if (servicesArray !== undefined) {
      if (!Array.isArray(servicesArray)) {
        return res.status(400).json({
          error: "servicesArray must be an array",
        });
      }

      // Validate each service object
      for (let i = 0; i < servicesArray.length; i++) {
        const service = servicesArray[i];
        const { isValid: serviceValid, missingKeys: serviceMissingKeys } =
          checkBodyReturnMissing(service, ["name", "filename", "pathToLogs"]);

        if (!serviceValid) {
          return res.status(400).json({
            error: `Service at index ${i} is missing required fields: ${serviceMissingKeys.join(", ")}`,
          });
        }

        // Validate that required fields are strings
        if (
          typeof service.name !== "string" ||
          typeof service.filename !== "string" ||
          typeof service.pathToLogs !== "string"
        ) {
          return res.status(400).json({
            error: `Service at index ${i}: name, filename, and pathToLogs must be strings`,
          });
        }

        // Validate optional fields if provided
        if (
          service.filenameTimer !== undefined &&
          typeof service.filenameTimer !== "string"
        ) {
          return res.status(400).json({
            error: `Service at index ${i}: filenameTimer must be a string`,
          });
        }

        if (service.port !== undefined && typeof service.port !== "number") {
          return res.status(400).json({
            error: `Service at index ${i}: port must be a number`,
          });
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
      urlFor404Api,
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
        urlFor404Api: machine.urlFor404Api,
        localIpAddress: machine.localIpAddress,
        nginxStoragePathOptions: machine.nginxStoragePathOptions,
        servicesArray: machine.servicesArray,
        createdAt: machine.createdAt,
        updatedAt: machine.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating machine:", error);
    res.status(500).json({ error: "Failed to create machine" });
  }
});

// 🔹 DELETE /machines/:id: Delete a machine
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const machine = await Machine.findByIdAndDelete(id);
    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    res.status(200).json({ message: "Machine deleted successfully" });
  } catch (error) {
    console.error("Error deleting machine:", error);
    res.status(500).json({ error: "Failed to delete machine" });
  }
});

export default router;
