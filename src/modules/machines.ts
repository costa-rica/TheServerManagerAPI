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
 *
 * Validation steps:
 * 1. Filename must not be null, empty, or whitespace-only
 * 2. Filename must end with '.service'
 * 3. Service file must exist at /etc/systemd/system/{filename}
 * 4. Reads the systemd service file to extract WorkingDirectory
 * 5. Reads environment file to extract app name:
 *    - First tries .env file with NAME_APP variable
 *    - If .env doesn't exist, falls back to .env.local with NEXT_PUBLIC_NAME_APP variable
 * 6. Updates the service object in place with name and workingDirectory
 *
 * @param service - Service object with filename property (will be updated in place)
 * @throws Error with standardized error format if validation fails
 */
async function getServicesNameAndValidateServiceFile(service: any): Promise<void> {
	const { filename } = service;

	// Validate filename is not null, undefined, empty, or whitespace-only
	if (!filename || typeof filename !== "string" || filename.trim() === "") {
		throw {
			error: {
				code: "VALIDATION_ERROR",
				message: "Invalid service filename",
				details: "Service filename cannot be null, empty, or whitespace-only",
				status: 400
			}
		};
	}

	// Validate filename ends with .service
	if (!filename.endsWith(".service")) {
		throw {
			error: {
				code: "VALIDATION_ERROR",
				message: "Invalid service filename",
				details: `Service filename must end with '.service'. Received: '${filename}'`,
				status: 400
			}
		};
	}

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
	const envLocalFilePath = path.join(workingDirectory, ".env.local");

	let envFileContent: string;
	let name: string;
	let envFileUsed: string;

	// Try .env first
	try {
		await fs.access(envFilePath);
		console.log(`[machines.ts] Found .env file for ${filename}`);

		// Read .env file
		try {
			envFileContent = await fs.readFile(envFilePath, "utf8");
			console.log(`[machines.ts] Successfully read .env file for ${filename}`);
			envFileUsed = ".env";
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

		name = nameAppMatch[1].trim();
		console.log(`[machines.ts] Found NAME_APP in .env for ${filename}: ${name}`);
	} catch (error: any) {
		// If .env doesn't exist, try .env.local
		if (error.error?.code) {
			// This is one of our thrown errors (read error or NAME_APP not found), re-throw it
			throw error;
		}

		// .env doesn't exist, try .env.local
		console.log(`[machines.ts] .env not found, trying .env.local for ${filename}`);
		try {
			await fs.access(envLocalFilePath);
			console.log(`[machines.ts] Found .env.local file for ${filename}`);
		} catch (error) {
			throw {
				error: {
					code: "ENV_FILE_NOT_FOUND",
					message: `Environment file not found`,
					details: `Neither .env nor .env.local file found in WorkingDirectory '${workingDirectory}' for service '${filename}'`,
					status: 400
				}
			};
		}

		// Read .env.local file
		try {
			envFileContent = await fs.readFile(envLocalFilePath, "utf8");
			console.log(`[machines.ts] Successfully read .env.local file for ${filename}`);
			envFileUsed = ".env.local";
		} catch (error: any) {
			throw {
				error: {
					code: "ENV_FILE_READ_ERROR",
					message: `Failed to read .env.local file`,
					details: `Permission error or failed to read .env.local file in '${workingDirectory}' for service '${filename}': ${error.message}`,
					status: 400
				}
			};
		}

		// Parse NEXT_PUBLIC_NAME_APP from .env.local file
		const nextPublicNameAppMatch = envFileContent.match(/^NEXT_PUBLIC_NAME_APP=(.+)$/m);
		if (!nextPublicNameAppMatch) {
			throw {
				error: {
					code: "NAME_APP_NOT_FOUND",
					message: `NEXT_PUBLIC_NAME_APP not found in .env.local file`,
					details: `NEXT_PUBLIC_NAME_APP variable not found in .env.local file for service '${filename}'`,
					status: 400
				}
			};
		}

		name = nextPublicNameAppMatch[1].trim();
		console.log(`[machines.ts] Found NEXT_PUBLIC_NAME_APP in .env.local for ${filename}: ${name}`);
	}

	// Update service object in place
	service.name = name;
	service.workingDirectory = workingDirectory;

	console.log(`[machines.ts] Successfully validated and populated service: ${filename}`);
}

export { getMachineInfo, getServicesNameAndValidateServiceFile };
