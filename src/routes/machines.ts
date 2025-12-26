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

// 🔹 PATCH /machines/:publicId: Update a machine
router.patch("/:publicId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { publicId } = req.params;
    const { urlFor404Api, nginxStoragePathOptions, servicesArray } = req.body;

    // Validate publicId parameter
    if (!publicId || typeof publicId !== "string" || publicId.trim() === "") {
      return res.status(400).json({
        error: "publicId parameter must be a non-empty string",
      });
    }

    // Find the machine by publicId
    const machine = await Machine.findOne({ publicId });
    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
      });
    }

    // Build update object with only provided fields
    const updates: any = {};

    // Validate and add urlFor404Api if provided
    if (urlFor404Api !== undefined) {
      if (typeof urlFor404Api !== "string" || urlFor404Api.trim() === "") {
        return res.status(400).json({
          error: "urlFor404Api must be a non-empty string",
        });
      }
      updates.urlFor404Api = urlFor404Api;
    }

    // Validate and add nginxStoragePathOptions if provided
    if (nginxStoragePathOptions !== undefined) {
      if (!Array.isArray(nginxStoragePathOptions)) {
        return res.status(400).json({
          error: "nginxStoragePathOptions must be an array of strings",
        });
      }
      updates.nginxStoragePathOptions = nginxStoragePathOptions;
    }

    // Validate and add servicesArray if provided
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

      updates.servicesArray = servicesArray;
    }

    // Check if at least one field is being updated
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "At least one field must be provided for update (urlFor404Api, nginxStoragePathOptions, or servicesArray)",
      });
    }

    // Update the machine
    const updatedMachine = await Machine.findOneAndUpdate(
      { publicId },
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Machine updated successfully",
      machine: {
        publicId: updatedMachine!.publicId,
        id: updatedMachine!._id,
        machineName: updatedMachine!.machineName,
        urlFor404Api: updatedMachine!.urlFor404Api,
        localIpAddress: updatedMachine!.localIpAddress,
        nginxStoragePathOptions: updatedMachine!.nginxStoragePathOptions,
        servicesArray: updatedMachine!.servicesArray,
        createdAt: updatedMachine!.createdAt,
        updatedAt: updatedMachine!.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating machine:", error);
    res.status(500).json({ error: "Failed to update machine" });
  }
});

// 🔹 DELETE /machines/:publicId: Delete a machine
router.delete("/:publicId", authenticateToken, async (req, res) => {
  try {
    const { publicId } = req.params;

    // Validate publicId parameter
    if (!publicId || typeof publicId !== "string" || publicId.trim() === "") {
      return res.status(400).json({
        error: "publicId parameter must be a non-empty string",
      });
    }

    const machine = await Machine.findOneAndDelete({ publicId });
    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    res.status(200).json({
      message: "Machine deleted successfully",
      deletedMachine: {
        publicId: machine.publicId,
        machineName: machine.machineName,
      }
    });
  } catch (error) {
    console.error("Error deleting machine:", error);
    res.status(500).json({ error: "Failed to delete machine" });
  }
});

export default router;
