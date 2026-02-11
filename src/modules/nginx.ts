import fs from "fs";
import path from "path";

/**
 * Interface for nginx config creation parameters
 */
export interface NginxConfigParams {
	templateFilePath: string;
	serverNamesArray: string[];
	localIpAddress: string;
	portNumber: number;
	saveDestination: string; // Full directory path where config will be saved
	outputFileName?: string; // Optional custom filename
}

/**
 * Interface for nginx config creation result
 */
export interface NginxConfigResult {
	success: boolean;
	filePath?: string;
	error?: string;
}

/**
 * Creates an nginx configuration file from a template
 * @param params - Configuration parameters
 * @returns Result object with success status and file path or error
 */
export async function createNginxConfigFromTemplate(
	params: NginxConfigParams
): Promise<NginxConfigResult> {
	try {
		const {
			templateFilePath,
			serverNamesArray,
			localIpAddress,
			portNumber,
			saveDestination,
			outputFileName,
		} = params;

		// 1. Read template file
		let templateContent: string;
		try {
			templateContent = await fs.promises.readFile(templateFilePath, "utf-8");
		} catch (error) {
			return {
				success: false,
				error: `Failed to read template file: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}

		// 2. Replace placeholders
		const primaryServerName = serverNamesArray[0];
		const allServerNames = serverNamesArray.join(" ");

		let processedContent = templateContent;

		// Replace server name placeholder with all server names
		processedContent = processedContent.replace(
			/<ReplaceMe: server name>/g,
			allServerNames
		);

		// Replace local IP placeholder
		processedContent = processedContent.replace(
			/<ReplaceMe: local ip>/g,
			localIpAddress
		);

		// Replace port number placeholder
		processedContent = processedContent.replace(
			/<ReplaceMe: port number>/g,
			portNumber.toString()
		);

		// 3. Use saveDestination as the target directory
		const targetDir = saveDestination;

		// 4. Determine output filename (use primary server name if not provided)
		const fileName = outputFileName || primaryServerName;
		const outputPath = path.join(targetDir, fileName);

		// 5. Check if target directory exists
		if (!fs.existsSync(targetDir)) {
			return {
				success: false,
				error: `Target directory does not exist: ${targetDir}`,
			};
		}

		// 6. Write the processed content to the target file
		try {
			await fs.promises.writeFile(outputPath, processedContent, "utf-8");
		} catch (error) {
			return {
				success: false,
				error: `Failed to write nginx config file: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}

		// 7. Return success with file path
		return {
			success: true,
			filePath: outputPath,
		};
	} catch (error) {
		return {
			success: false,
			error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}
