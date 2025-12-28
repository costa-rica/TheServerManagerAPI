/**
 * Nginx configuration file parser
 * Extracts server names, ports, IPs, and framework information from nginx config files
 */

import { Machine } from "../models/machine";

export interface ParsedNginxConfig {
	serverNames: string[];
	listenPort: number | null;
	localIpAddress: string | null;
	framework: string;
}

export interface PopulatedNginxFile {
	publicId: string;
	serverName: string;
	portNumber: number;
	serverNameArrayOfAdditionalServerNames?: string[];
	appHostServerMachinePublicId: string | null;
	machineNameAppHost: string | null;
	localIpAddressAppHost: string | null;
	nginxHostServerMachinePublicId: string | null;
	machineNameNginxHost: string | null;
	localIpAddressNginxHost: string | null;
	framework: string;
	storeDirectory: string;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Parse nginx configuration file content
 * @param content - The raw content of the nginx config file
 * @returns Parsed configuration data
 */
export function parseNginxConfig(content: string): ParsedNginxConfig {
	const result: ParsedNginxConfig = {
		serverNames: [],
		listenPort: null,
		localIpAddress: null,
		framework: "ExpressJs", // Default framework
	};

	// Extract server_name(s)
	// Pattern: server_name domain1.com domain2.com;
	const serverNameRegex = /server_name\s+([^;]+);/g;
	let match;

	while ((match = serverNameRegex.exec(content)) !== null) {
		const names = match[1]
			.trim()
			.split(/\s+/)
			.filter((name) => name && name !== "");
		result.serverNames.push(...names);
	}

	// Remove duplicates from server names
	const uniqueNames: string[] = [];
	const seen: { [key: string]: boolean } = {};
	for (const name of result.serverNames) {
		if (!seen[name]) {
			seen[name] = true;
			uniqueNames.push(name);
		}
	}
	result.serverNames = uniqueNames;

	// Extract proxy_pass IP and port
	// Pattern: proxy_pass http://192.168.100.17:8001;
	const proxyPassRegex = /proxy_pass\s+http:\/\/([0-9.]+):(\d+);/;
	const proxyMatch = content.match(proxyPassRegex);

	if (proxyMatch) {
		result.localIpAddress = proxyMatch[1];
		result.listenPort = parseInt(proxyMatch[2], 10);
	}

	// Detect framework based on presence of "location /static {"
	if (/location\s+\/static\s*{/.test(content)) {
		result.framework = "Next.js / Python";
	}

	return result;
}

/**
 * Populate nginx files with machine data (machineName and localIpAddress)
 * Strips MongoDB internal fields (_id, __v) from response
 * @param nginxFiles - Array of NginxFile documents from database
 * @returns Array of populated nginx file objects with machine data
 */
export async function populateNginxFilesWithMachineData(
	nginxFiles: any[]
): Promise<PopulatedNginxFile[]> {
	// 1. Extract unique machine publicIds from both appHost and nginxHost
	const machinePublicIds = new Set<string>();

	nginxFiles.forEach((file) => {
		if (file.appHostServerMachinePublicId) {
			machinePublicIds.add(file.appHostServerMachinePublicId);
		}
		if (file.nginxHostServerMachinePublicId) {
			machinePublicIds.add(file.nginxHostServerMachinePublicId);
		}
	});

	// 2. Fetch all relevant machines in one bulk query
	const machines = await Machine.find({
		publicId: { $in: Array.from(machinePublicIds) },
	});

	// 3. Create a lookup map for O(1) access
	const machineMap = new Map<
		string,
		{ publicId: string; machineName: string; localIpAddress: string }
	>();

	machines.forEach((machine) => {
		machineMap.set(machine.publicId, {
			publicId: machine.publicId,
			machineName: machine.machineName,
			localIpAddress: machine.localIpAddress,
		});
	});

	// 4. Enhance nginxFiles with machine data and strip MongoDB internals
	const enhancedNginxFiles: PopulatedNginxFile[] = nginxFiles.map((file) => {
		const fileObj = file.toObject ? file.toObject() : file;

		// Look up appHost machine data
		const appHostMachine = fileObj.appHostServerMachinePublicId
			? machineMap.get(fileObj.appHostServerMachinePublicId)
			: null;

		// Look up nginxHost machine data
		const nginxHostMachine = fileObj.nginxHostServerMachinePublicId
			? machineMap.get(fileObj.nginxHostServerMachinePublicId)
			: null;

		// Build response object without _id and __v
		return {
			publicId: fileObj.publicId,
			serverName: fileObj.serverName,
			portNumber: fileObj.portNumber,
			serverNameArrayOfAdditionalServerNames:
				fileObj.serverNameArrayOfAdditionalServerNames,
			appHostServerMachinePublicId: fileObj.appHostServerMachinePublicId,
			machineNameAppHost: appHostMachine?.machineName || null,
			localIpAddressAppHost: appHostMachine?.localIpAddress || null,
			nginxHostServerMachinePublicId: fileObj.nginxHostServerMachinePublicId,
			machineNameNginxHost: nginxHostMachine?.machineName || null,
			localIpAddressNginxHost: nginxHostMachine?.localIpAddress || null,
			framework: fileObj.framework,
			storeDirectory: fileObj.storeDirectory,
			createdAt: fileObj.createdAt,
			updatedAt: fileObj.updatedAt,
		};
	});

	return enhancedNginxFiles;
}
