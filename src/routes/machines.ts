import express from "express";
import type { Request, Response } from "express";
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
    const { urlFor404Api, nginxStoragePathOptions } = req.body;

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

    // Get machine name and local IP address from OS
    const { machineName, localIpAddress } = getMachineInfo();

    // Create the machine document
    const machine = await Machine.create({
      machineName,
      urlFor404Api,
      localIpAddress,
      nginxStoragePathOptions,
    });

    res.status(201).json({
      message: "Machine created successfully",
      machine: {
        id: machine._id,
        machineName: machine.machineName,
        urlFor404Api: machine.urlFor404Api,
        localIpAddress: machine.localIpAddress,
        nginxStoragePathOptions: machine.nginxStoragePathOptions,
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
