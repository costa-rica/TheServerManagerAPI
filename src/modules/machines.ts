import os from "os";
import fs from "fs/promises";
import path from "path";
import logger from "../config/logger";

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
 *    - First tries .env file, then falls back to .env.local if not found
 *    - Searches for "NAME_APP=" string and extracts the value to the right
 *    - This matches both NAME_APP and NEXT_PUBLIC_NAME_APP variables
 * 6. Updates the service object in place with name and workingDirectory
 *
 * @param service - Service object with filename property (will be updated in place)
 * @throws Error with standardized error format if validation fails
 */
async function getServicesNameAndValidateServiceFile(service: any): Promise<void> {
	const { filename } = service;
	logger.info(`[machines.ts getServicesNameAndValidateServiceFile] Starting validation for: ${filename}`);

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

	logger.info(`[machines.ts] Validating service file: ${filename}`);

	// Check if service file exists and is accessible
	try {
		await fs.access(serviceFilePath);
		logger.info(`[machines.ts getServicesNameAndValidateServiceFile] fs.access succeeded for: ${serviceFilePath}`);
	} catch (error: any) {
		logger.info(`[machines.ts getServicesNameAndValidateServiceFile] fs.access failed for ${serviceFilePath}. Error code: ${error.code}`);

		// Distinguish between file not found and permission denied
		if (error.code === 'EACCES' || error.code === 'EPERM') {
			logger.info(`[machines.ts getServicesNameAndValidateServiceFile] Throwing 403 PERMISSION_DENIED for: ${filename}`);
			throw {
				error: {
					code: "SERVICE_FILE_PERMISSION_DENIED",
					message: `Permission denied accessing service file`,
					details: process.env.NODE_ENV !== 'production' ? `Service file '${filename}' exists at ${serviceFilePath} but cannot be accessed due to insufficient permissions` : undefined,
					status: 403
				}
			};
		}

		// File doesn't exist (ENOENT) or other error
		logger.info(`[machines.ts getServicesNameAndValidateServiceFile] Throwing 404 NOT_FOUND for: ${filename} (error code: ${error.code})`);
		throw {
			error: {
				code: "SERVICE_FILE_NOT_FOUND",
				message: `Service file not found`,
				details: `Service file '${filename}' does not exist at ${serviceFilePath}`,
				status: 404
			}
		};
	}

	// Read service file
	let serviceFileContent: string;
	try {
		serviceFileContent = await fs.readFile(serviceFilePath, "utf8");
		logger.info(`[machines.ts] Successfully read service file: ${filename}`);
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
	logger.info(`[machines.ts] Found WorkingDirectory for ${filename}: ${workingDirectory}`);

	// Check if WorkingDirectory exists and is accessible
	try {
		await fs.access(workingDirectory);
	} catch (error: any) {
		// Distinguish between directory not found and permission denied
		if (error.code === 'EACCES' || error.code === 'EPERM') {
			throw {
				error: {
					code: "WORKING_DIRECTORY_PERMISSION_DENIED",
					message: `Permission denied accessing WorkingDirectory`,
					details: process.env.NODE_ENV !== 'production' ? `WorkingDirectory '${workingDirectory}' specified in service file '${filename}' exists but cannot be accessed due to insufficient permissions` : undefined,
					status: 403
				}
			};
		}

		// Directory doesn't exist (ENOENT) or other error
		throw {
			error: {
				code: "WORKING_DIRECTORY_NOT_FOUND",
				message: `WorkingDirectory does not exist`,
				details: `WorkingDirectory '${workingDirectory}' specified in service file '${filename}' does not exist`,
				status: 404
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
		logger.info(`[machines.ts] Found .env file for ${filename}`);

		// Read .env file
		try {
			envFileContent = await fs.readFile(envFilePath, "utf8");
			logger.info(`[machines.ts] Successfully read .env file for ${filename}`);
			envFileUsed = ".env";
		} catch (error: any) {
			// Distinguish between permission denied and other read errors
			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw {
					error: {
						code: "ENV_FILE_PERMISSION_DENIED",
						message: `Permission denied reading .env file`,
						details: process.env.NODE_ENV !== 'production' ? `.env file exists in '${workingDirectory}' for service '${filename}' but cannot be read due to insufficient permissions` : undefined,
						status: 403
					}
				};
			}

			throw {
				error: {
					code: "ENV_FILE_READ_ERROR",
					message: `Failed to read .env file`,
					details: process.env.NODE_ENV !== 'production' ? `Failed to read .env file in '${workingDirectory}' for service '${filename}': ${error.message}` : undefined,
					status: 500
				}
			};
		}

		// Parse NAME_APP from .env file (matches both NAME_APP and NEXT_PUBLIC_NAME_APP)
		const nameAppMatch = envFileContent.match(/NAME_APP=(.+)$/m);
		if (!nameAppMatch) {
			throw {
				error: {
					code: "NAME_APP_NOT_FOUND",
					message: `NAME_APP variable not found in .env file`,
					details: `No variable containing "NAME_APP=" found in .env file for service '${filename}'`,
					status: 400
				}
			};
		}

		name = nameAppMatch[1].trim();
		logger.info(`[machines.ts] Found NAME_APP in .env for ${filename}: ${name}`);
	} catch (error: any) {
		// If .env doesn't exist, try .env.local
		if (error.error?.code) {
			// This is one of our thrown errors (read error or NAME_APP not found), re-throw it
			throw error;
		}

		// .env doesn't exist, try .env.local
		logger.info(`[machines.ts] .env not found, trying .env.local for ${filename}`);
		try {
			await fs.access(envLocalFilePath);
			logger.info(`[machines.ts] Found .env.local file for ${filename}`);
		} catch (error: any) {
			// Distinguish between file not found and permission denied
			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw {
					error: {
						code: "ENV_FILE_PERMISSION_DENIED",
						message: `Permission denied accessing .env.local file`,
						details: process.env.NODE_ENV !== 'production' ? `.env.local file exists in '${workingDirectory}' for service '${filename}' but cannot be accessed due to insufficient permissions` : undefined,
						status: 403
					}
				};
			}

			// Neither .env nor .env.local found
			throw {
				error: {
					code: "ENV_FILE_NOT_FOUND",
					message: `Environment file not found`,
					details: `Neither .env nor .env.local file found in WorkingDirectory '${workingDirectory}' for service '${filename}'`,
					status: 404
				}
			};
		}

		// Read .env.local file
		try {
			envFileContent = await fs.readFile(envLocalFilePath, "utf8");
			logger.info(`[machines.ts] Successfully read .env.local file for ${filename}`);
			envFileUsed = ".env.local";
		} catch (error: any) {
			// Distinguish between permission denied and other read errors
			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw {
					error: {
						code: "ENV_FILE_PERMISSION_DENIED",
						message: `Permission denied reading .env.local file`,
						details: process.env.NODE_ENV !== 'production' ? `.env.local file exists in '${workingDirectory}' for service '${filename}' but cannot be read due to insufficient permissions` : undefined,
						status: 403
					}
				};
			}

			throw {
				error: {
					code: "ENV_FILE_READ_ERROR",
					message: `Failed to read .env.local file`,
					details: process.env.NODE_ENV !== 'production' ? `Failed to read .env.local file in '${workingDirectory}' for service '${filename}': ${error.message}` : undefined,
					status: 500
				}
			};
		}

		// Parse NAME_APP from .env.local file (matches both NAME_APP and NEXT_PUBLIC_NAME_APP)
		const nameAppMatchLocal = envFileContent.match(/NAME_APP=(.+)$/m);
		if (!nameAppMatchLocal) {
			throw {
				error: {
					code: "NAME_APP_NOT_FOUND",
					message: `NAME_APP variable not found in .env.local file`,
					details: `No variable containing "NAME_APP=" found in .env.local file for service '${filename}'`,
					status: 400
				}
			};
		}

		name = nameAppMatchLocal[1].trim();
		logger.info(`[machines.ts] Found NAME_APP in .env.local for ${filename}: ${name}`);
	}

	// Update service object in place
	service.name = name;
	service.workingDirectory = workingDirectory;

	logger.info(`[machines.ts] Successfully validated and populated service: ${filename}`);
}

/**
 * Reads and parses the nick-systemctl.csv file
 * @param csvPath - Path to the CSV file
 * @returns Array of unit filenames from the CSV
 * @throws Error if file doesn't exist or can't be read
 */
async function readNickSystemctlCsv(csvPath: string): Promise<string[]> {
	// Check if CSV file exists and is accessible
	try {
		await fs.access(csvPath);
	} catch (error: any) {
		// Distinguish between file not found and permission denied
		if (error.code === 'EACCES' || error.code === 'EPERM') {
			throw {
				error: {
					code: "CSV_FILE_PERMISSION_DENIED",
					message: "Permission denied accessing CSV file",
					details: process.env.NODE_ENV !== 'production' ? `The file ${csvPath} exists but cannot be accessed due to insufficient permissions` : undefined,
					status: 403
				}
			};
		}

		throw {
			error: {
				code: "CSV_FILE_NOT_FOUND",
				message: "CSV file not found",
				details: `The file ${csvPath} does not exist on this server`,
				status: 404
			}
		};
	}

	// Read CSV file
	let csvContent: string;
	try {
		csvContent = await fs.readFile(csvPath, "utf8");
	} catch (error: any) {
		throw {
			error: {
				code: "CSV_FILE_READ_ERROR",
				message: "Failed to read CSV file",
				details: process.env.NODE_ENV !== "production" ? error.message : undefined,
				status: 500
			}
		};
	}

	// Parse CSV and extract unique unit filenames
	const lines = csvContent.trim().split("\n");
	const units: string[] = [];

	// Skip header row (line 0)
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const columns = line.split(",");
		if (columns.length >= 6) {
			const unit = columns[5].trim();
			if (unit && !units.includes(unit)) {
				units.push(unit);
			}
		}
	}

	return units;
}

/**
 * Builds a service map from CSV units, linking .timer files to their corresponding .service files
 * @param units - Array of unit filenames from CSV
 * @returns Map of service filenames to their timer files (if any)
 * @throws Error if orphaned .timer file is found
 */
function buildServiceMapFromCsv(units: string[]): Map<string, { timerFile?: string }> {
	const serviceMap = new Map<string, { timerFile?: string }>();
	const timerFiles: string[] = [];

	// First pass: collect all .service files and .timer files
	for (const unit of units) {
		if (unit.endsWith(".service")) {
			serviceMap.set(unit, {});
		} else if (unit.endsWith(".timer")) {
			timerFiles.push(unit);
		}
	}

	// Second pass: match .timer files to their .service files
	for (const timerFile of timerFiles) {
		const serviceFileName = timerFile.replace(".timer", ".service");

		if (!serviceMap.has(serviceFileName)) {
			throw {
				error: {
					code: "ORPHANED_TIMER_FILE",
					message: "Orphaned timer file found",
					details: `Timer file '${timerFile}' found in CSV but corresponding service file '${serviceFileName}' is not present in the CSV`,
					status: 400
				}
			};
		}

		// Link timer to service
		const serviceEntry = serviceMap.get(serviceFileName);
		if (serviceEntry) {
			serviceEntry.timerFile = timerFile;
		}
	}

	return serviceMap;
}

/**
 * Checks that all service files exist in /etc/systemd/system/
 * @param serviceMap - Map of service filenames
 * @throws Error if any service file is not found
 */
async function checkServiceFilesExist(serviceMap: Map<string, { timerFile?: string }>): Promise<void> {
	const systemdPath = "/etc/systemd/system";

	for (const [serviceFileName] of Array.from(serviceMap.entries())) {
		const serviceFilePath = path.join(systemdPath, serviceFileName);

		try {
			await fs.access(serviceFilePath);
		} catch (error: any) {
			// Distinguish between file not found and permission denied
			if (error.code === 'EACCES' || error.code === 'EPERM') {
				throw {
					error: {
						code: "SERVICE_FILE_PERMISSION_DENIED",
						message: "Permission denied accessing service file in systemd directory",
						details: process.env.NODE_ENV !== 'production' ? `Service file '${serviceFileName}' is listed in the CSV and exists at ${serviceFilePath} but cannot be accessed due to insufficient permissions` : undefined,
						status: 403
					}
				};
			}

			throw {
				error: {
					code: "SERVICE_FILE_NOT_FOUND_IN_DIRECTORY",
					message: "Service file not found in systemd directory",
					details: `Service file '${serviceFileName}' is listed in the CSV but does not exist at ${serviceFilePath}`,
					status: 404
				}
			};
		}
	}
}

/**
 * Extracts port number from a service file
 * Looks for "PORT=", "0.0.0.0:", or "--port" followed by exactly 4 digits
 * @param serviceFileName - Name of the service file
 * @returns Port number or undefined if not found
 * @throws Error if port format is invalid (not exactly 4 digits)
 */
async function extractPortFromServiceFile(serviceFileName: string): Promise<number | undefined> {
	const serviceFilePath = path.join("/etc/systemd/system", serviceFileName);

	let serviceFileContent: string;
	try {
		serviceFileContent = await fs.readFile(serviceFilePath, "utf8");
	} catch (error: any) {
		throw {
			error: {
				code: "SERVICE_FILE_READ_ERROR",
				message: "Failed to read service file",
				details: process.env.NODE_ENV !== "production" ? error.message : undefined,
				status: 500
			}
		};
	}

	// Search for "PORT=", "0.0.0.0:", or "--port" followed by digits
	const portPatterns = [
		/PORT=(\d+)/,
		/0\.0\.0\.0:(\d+)/,
		/--port\s+(\d+)/
	];

	for (const pattern of portPatterns) {
		const match = serviceFileContent.match(pattern);
		if (match) {
			const portString = match[1];

			// Validate exactly 4 digits
			if (portString.length !== 4) {
				throw {
					error: {
						code: "INVALID_PORT_FORMAT",
						message: "Invalid port number format",
						details: `Service file '${serviceFileName}' contains port number '${portString}' which is not exactly 4 digits`,
						status: 400
					}
				};
			}

			return parseInt(portString, 10);
		}
	}

	// No port found - this is acceptable
	return undefined;
}

/**
 * Main function to build services array from nick-systemctl.csv
 * @returns Array of service objects with filename, port (optional), and filenameTimer (optional)
 */
async function buildServicesArrayFromNickSystemctl(): Promise<Array<{
	filename: string;
	port?: number;
	filenameTimer?: string;
}>> {
	const csvPath = "/home/nick/nick-systemctl.csv";

	// Step 1: Read CSV and extract units
	const units = await readNickSystemctlCsv(csvPath);

	// Step 2: Build service map and validate no orphaned timers
	const serviceMap = buildServiceMapFromCsv(units);

	// Step 3: Check all service files exist in /etc/systemd/system/
	await checkServiceFilesExist(serviceMap);

	// Step 4: Build the response array
	const servicesArray: Array<{
		filename: string;
		port?: number;
		filenameTimer?: string;
	}> = [];

	for (const [serviceFileName, { timerFile }] of Array.from(serviceMap.entries())) {
		const serviceEntry: {
			filename: string;
			port?: number;
			filenameTimer?: string;
		} = {
			filename: serviceFileName
		};

		// Extract port from service file
		const port = await extractPortFromServiceFile(serviceFileName);
		if (port !== undefined) {
			serviceEntry.port = port;
		}

		// Add timer file if exists
		if (timerFile) {
			serviceEntry.filenameTimer = timerFile;
		}

		servicesArray.push(serviceEntry);
	}

	return servicesArray;
}

export {
	getMachineInfo,
	getServicesNameAndValidateServiceFile,
	buildServicesArrayFromNickSystemctl
};
