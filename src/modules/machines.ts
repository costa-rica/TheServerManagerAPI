import os from "os";
import fs from "fs/promises";
import path from "path";

// Helper function to get machine name and local IP address
function getMachineInfo(): { machineName: string; localIpAddress: string } {
	// Get machine hostname
	const machineName = os.hostname();

	// Get network interfaces
	const networkInterfaces = os.networkInterfaces();
	let localIpAddress = "";

	// Find the first non-internal IPv4 address
	for (const interfaceName in networkInterfaces) {
		const interfaces = networkInterfaces[interfaceName];
		if (!interfaces) continue;

		for (const iface of interfaces) {
			// Skip internal (i.e., 127.0.0.1) and non-IPv4 addresses
			if (iface.family === "IPv4" && !iface.internal) {
				localIpAddress = iface.address;
				break;
			}
		}

		if (localIpAddress) break;
	}

	// If no external IPv4 found, fallback to localhost
	if (!localIpAddress) {
		localIpAddress = "127.0.0.1";
	}

	return { machineName, localIpAddress };
}

/**
 * Validates a service file and populates the service's name and workingDirectory
 * Reads the systemd service file to extract WorkingDirectory
 * Reads the .env file in WorkingDirectory to extract NAME_APP
 * Updates the service object in place with name and workingDirectory
 *
 * @param service - Service object with filename property (will be updated in place)
 * @throws Error with standardized error format if validation fails
 */
async function getServicesNameAndValidateServiceFile(service: any): Promise<void> {
	const { filename } = service;
	const serviceFilePath = `/etc/systemd/system/${filename}`;

	console.log(`[machines.ts] Validating service file: ${filename}`);

	// Check if service file exists
	try {
		await fs.access(serviceFilePath);
	} catch (error) {
		throw {
			error: {
				code: "SERVICE_FILE_NOT_FOUND",
				message: `Service file not found`,
				details: `Service file '${filename}' does not exist at ${serviceFilePath}`,
				status: 400
			}
		};
	}

	// Read service file
	let serviceFileContent: string;
	try {
		serviceFileContent = await fs.readFile(serviceFilePath, "utf8");
		console.log(`[machines.ts] Successfully read service file: ${filename}`);
	} catch (error: any) {
		throw {
			error: {
				code: "SERVICE_FILE_READ_ERROR",
				message: `Failed to read service file`,
				details: `Permission error or failed to read service file '${filename}': ${error.message}`,
				status: 400
			}
		};
	}

	// Parse WorkingDirectory from service file
	const workingDirectoryMatch = serviceFileContent.match(/^WorkingDirectory=(.+)$/m);
	if (!workingDirectoryMatch) {
		throw {
			error: {
				code: "WORKING_DIRECTORY_NOT_FOUND",
				message: `WorkingDirectory not found in service file`,
				details: `Service file '${filename}' is missing the WorkingDirectory property`,
				status: 400
			}
		};
	}

	const workingDirectory = workingDirectoryMatch[1].trim();
	console.log(`[machines.ts] Found WorkingDirectory for ${filename}: ${workingDirectory}`);

	// Check if WorkingDirectory exists
	try {
		await fs.access(workingDirectory);
	} catch (error) {
		throw {
			error: {
				code: "WORKING_DIRECTORY_NOT_FOUND",
				message: `WorkingDirectory does not exist`,
				details: `WorkingDirectory '${workingDirectory}' specified in service file '${filename}' does not exist`,
				status: 400
			}
		};
	}

	// Check if .env file exists in WorkingDirectory
	const envFilePath = path.join(workingDirectory, ".env");
	try {
		await fs.access(envFilePath);
	} catch (error) {
		throw {
			error: {
				code: "ENV_FILE_NOT_FOUND",
				message: `.env file not found`,
				details: `.env file not found in WorkingDirectory '${workingDirectory}' for service '${filename}'`,
				status: 400
			}
		};
	}

	// Read .env file
	let envFileContent: string;
	try {
		envFileContent = await fs.readFile(envFilePath, "utf8");
		console.log(`[machines.ts] Successfully read .env file for ${filename}`);
	} catch (error: any) {
		throw {
			error: {
				code: "ENV_FILE_READ_ERROR",
				message: `Failed to read .env file`,
				details: `Permission error or failed to read .env file in '${workingDirectory}' for service '${filename}': ${error.message}`,
				status: 400
			}
		};
	}

	// Parse NAME_APP from .env file
	const nameAppMatch = envFileContent.match(/^NAME_APP=(.+)$/m);
	if (!nameAppMatch) {
		throw {
			error: {
				code: "NAME_APP_NOT_FOUND",
				message: `NAME_APP not found in .env file`,
				details: `NAME_APP variable not found in .env file for service '${filename}'`,
				status: 400
			}
		};
	}

	const name = nameAppMatch[1].trim();
	console.log(`[machines.ts] Found NAME_APP for ${filename}: ${name}`);

	// Update service object in place
	service.name = name;
	service.workingDirectory = workingDirectory;

	console.log(`[machines.ts] Successfully validated and populated service: ${filename}`);
}

export { getMachineInfo, getServicesNameAndValidateServiceFile };
