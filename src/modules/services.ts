import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import logger from "../config/logger";

const execAsync = promisify(exec);

/**
 * Execute a systemctl status command and return the output
 * @param filename - The service or timer filename (e.g., "myapp.service")
 * @returns Promise with stdout and stderr
 */
export async function executeSystemctlStatus(
  filename: string
): Promise<{ stdout: string; stderr: string }> {
  const command = `sudo systemctl status ${filename}`;
  logger.info(`[services.ts] Executing command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command);
    logger.info(`[services.ts] Command succeeded for ${filename}`);
    logger.info(`[services.ts] stdout length: ${stdout.length} chars`);
    if (stderr) {
      logger.warn(`[services.ts] stderr for ${filename}: ${stderr}`);
    }
    return { stdout, stderr };
  } catch (error: any) {
    // systemctl returns non-zero exit code for inactive services
    // We still want to capture the output
    logger.warn(`[services.ts] Command failed with non-zero exit for ${filename}`);
    logger.info(`[services.ts] Error code: ${error.code}`);
    logger.info(`[services.ts] Error message: ${error.message}`);
    logger.info(`[services.ts] stdout length: ${error.stdout?.length || 0} chars`);
    logger.info(`[services.ts] stderr: ${error.stderr || 'none'}`);

    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
    };
  }
}

/**
 * Parse the "Loaded" line from systemctl status output
 * @param output - The stdout from systemctl status command
 * @returns The loaded line (e.g., "loaded (/etc/systemd/system/myapp.service; enabled; preset: enabled)")
 */
export function parseLoadedStatus(output: string): string {
  logger.info(`[services.ts] Parsing loaded status from ${output.length} chars of output`);

  if (!output || output.trim().length === 0) {
    logger.warn(`[services.ts] Output is empty, cannot parse loaded status`);
    return "unknown";
  }

  const lines = output.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("Loaded:")) {
      // Extract everything after "Loaded: "
      const loaded = trimmedLine.replace(/^Loaded:\s*/, "");
      logger.info(`[services.ts] Found Loaded status: ${loaded}`);
      return loaded;
    }
  }

  logger.warn(`[services.ts] No "Loaded:" line found in output`);
  return "unknown";
}

/**
 * Extract onStartStatus (enabled/disabled) from loaded status line
 * @param loadedLine - The loaded line from systemctl status
 * @returns "enabled" or "disabled" or "unknown"
 */
export function extractOnStartStatus(loadedLine: string): string {
  if (!loadedLine || loadedLine === "unknown") {
    return "unknown";
  }

  // The loaded line format is typically:
  // "loaded (/etc/systemd/system/myapp.service; enabled; preset: enabled)"
  // or "loaded (/etc/systemd/system/myapp.service; disabled; preset: enabled)"

  // Look for "enabled" or "disabled" between semicolons
  if (loadedLine.includes("; enabled;") || loadedLine.includes("; enabled)")) {
    logger.info(`[services.ts] Service is enabled`);
    return "enabled";
  } else if (loadedLine.includes("; disabled;") || loadedLine.includes("; disabled)")) {
    logger.info(`[services.ts] Service is disabled`);
    return "disabled";
  } else if (loadedLine.includes("; static;") || loadedLine.includes("; static)")) {
    logger.info(`[services.ts] Service is static (cannot be enabled/disabled)`);
    return "static";
  }

  logger.warn(`[services.ts] Could not determine enabled/disabled status from: ${loadedLine}`);
  return "unknown";
}

/**
 * Simplify the active status to just "active" or "inactive"
 * @param activeLine - The active line from systemctl status (e.g., "active (running) since...")
 * @returns "active" or "inactive" or "unknown"
 */
export function simplifyActiveStatus(activeLine: string): string {
  if (!activeLine || activeLine === "unknown") {
    return "unknown";
  }

  const lowerActiveLine = activeLine.toLowerCase();

  if (lowerActiveLine.startsWith("active")) {
    logger.info(`[services.ts] Simplified status: active`);
    return "active";
  } else if (lowerActiveLine.startsWith("inactive")) {
    logger.info(`[services.ts] Simplified status: inactive`);
    return "inactive";
  } else if (lowerActiveLine.startsWith("failed")) {
    logger.info(`[services.ts] Simplified status: failed`);
    return "failed";
  } else if (lowerActiveLine.startsWith("activating")) {
    logger.info(`[services.ts] Simplified status: activating`);
    return "activating";
  } else if (lowerActiveLine.startsWith("deactivating")) {
    logger.info(`[services.ts] Simplified status: deactivating`);
    return "deactivating";
  }

  logger.warn(`[services.ts] Could not simplify active status from: ${activeLine}`);
  return "unknown";
}

/**
 * Parse the service status from systemctl status output
 * @param output - The stdout from systemctl status command
 * @returns Object with loaded, active, status, and onStartStatus
 */
export function parseServiceStatus(output: string): {
  loaded: string;
  active: string;
  status: string;
  onStartStatus: string;
} {
  logger.info(`[services.ts] Parsing service status from ${output.length} chars of output`);

  if (!output || output.trim().length === 0) {
    logger.warn(`[services.ts] Output is empty, cannot parse status`);
    return {
      loaded: "unknown",
      active: "unknown",
      status: "unknown",
      onStartStatus: "unknown",
    };
  }

  const lines = output.split("\n");
  logger.info(`[services.ts] Output has ${lines.length} lines`);

  let activeLine = "unknown";
  let loadedLine = "unknown";

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("Active:")) {
      // Extract everything after "Active: "
      activeLine = trimmedLine.replace(/^Active:\s*/, "");
      logger.info(`[services.ts] Found Active status: ${activeLine}`);
    }

    if (trimmedLine.startsWith("Loaded:")) {
      // Extract everything after "Loaded: "
      loadedLine = trimmedLine.replace(/^Loaded:\s*/, "");
      logger.info(`[services.ts] Found Loaded status: ${loadedLine}`);
    }
  }

  if (activeLine === "unknown") {
    logger.warn(`[services.ts] No "Active:" line found in output`);
    logger.info(`[services.ts] First 200 chars of output: ${output.substring(0, 200)}`);
  }

  if (loadedLine === "unknown") {
    logger.warn(`[services.ts] No "Loaded:" line found in output`);
  }

  const status = simplifyActiveStatus(activeLine);
  const onStartStatus = extractOnStartStatus(loadedLine);

  return {
    loaded: loadedLine,
    active: activeLine,
    status,
    onStartStatus,
  };
}

/**
 * Parse the timer status and trigger from systemctl status output for a timer
 * @param output - The stdout from systemctl status command for a timer
 * @returns Object with timerLoaded, timerActive, timerStatus, timerOnStartStatus, and timerTrigger
 */
export function parseTimerStatus(output: string): {
  timerLoaded: string;
  timerActive: string;
  timerStatus: string;
  timerOnStartStatus: string;
  timerTrigger: string;
} {
  logger.info(`[services.ts] Parsing timer status from ${output.length} chars of output`);

  if (!output || output.trim().length === 0) {
    logger.warn(`[services.ts] Timer output is empty, cannot parse`);
    return {
      timerLoaded: "unknown",
      timerActive: "unknown",
      timerStatus: "unknown",
      timerOnStartStatus: "unknown",
      timerTrigger: "unknown"
    };
  }

  const lines = output.split("\n");
  let timerLoaded = "unknown";
  let timerActive = "unknown";
  let timerTrigger = "unknown";

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("Loaded:")) {
      timerLoaded = trimmedLine.replace(/^Loaded:\s*/, "");
      logger.info(`[services.ts] Found timer Loaded status: ${timerLoaded}`);
    }

    if (trimmedLine.startsWith("Active:")) {
      timerActive = trimmedLine.replace(/^Active:\s*/, "");
      logger.info(`[services.ts] Found timer Active status: ${timerActive}`);
    }

    if (trimmedLine.startsWith("Trigger:")) {
      timerTrigger = trimmedLine.replace(/^Trigger:\s*/, "");
      logger.info(`[services.ts] Found timer Trigger: ${timerTrigger}`);
    }
  }

  if (timerLoaded === "unknown" || timerActive === "unknown" || timerTrigger === "unknown") {
    logger.warn(`[services.ts] Could not find Loaded, Active, or Trigger in timer output`);
    logger.info(`[services.ts] First 200 chars of timer output: ${output.substring(0, 200)}`);
  }

  // Simplify the active status to just "active" or "inactive"
  const timerStatus = simplifyActiveStatus(timerActive);

  // Extract enabled/disabled/static status from loaded line
  const timerOnStartStatus = extractOnStartStatus(timerLoaded);

  return { timerLoaded, timerActive, timerStatus, timerOnStartStatus, timerTrigger };
}

/**
 * Get the status of a service by executing systemctl status command
 * @param filename - The service filename (e.g., "myapp.service")
 * @returns Object with loaded, active, status, and onStartStatus
 */
export async function getServiceStatus(filename: string): Promise<{
  loaded: string;
  active: string;
  status: string;
  onStartStatus: string;
}> {
  logger.info(`[services.ts] Getting service status for: ${filename}`);
  const { stdout } = await executeSystemctlStatus(filename);
  const statusObj = parseServiceStatus(stdout);
  logger.info(`[services.ts] Final status for ${filename}:`, statusObj);
  return statusObj;
}

/**
 * Get the timer status and trigger for a service timer
 * @param filenameTimer - The timer filename (e.g., "myapp.timer")
 * @returns Object with timerLoaded, timerActive, timerStatus, timerOnStartStatus, and timerTrigger
 */
export async function getTimerStatusAndTrigger(
  filenameTimer: string
): Promise<{ timerLoaded: string; timerActive: string; timerStatus: string; timerOnStartStatus: string; timerTrigger: string }> {
  logger.info(`[services.ts] Getting timer status for: ${filenameTimer}`);
  const { stdout } = await executeSystemctlStatus(filenameTimer);
  const result = parseTimerStatus(stdout);
  logger.info(`[services.ts] Final timer status for ${filenameTimer}: ${JSON.stringify(result)}`);
  return result;
}

/**
 * Execute a systemctl command to control a service (start, stop, restart, etc.)
 * @param action - The systemctl action (start, stop, restart, reload, enable, disable)
 * @param filename - The service filename (e.g., "myapp.service")
 * @returns Object with success status and output
 */
export async function toggleService(
  action: string,
  filename: string
): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
  const command = `sudo systemctl ${action} ${filename}`;
  logger.info(`[services.ts] Executing toggle command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command);
    logger.info(`[services.ts] Toggle command succeeded for ${action} ${filename}`);
    return { success: true, stdout, stderr };
  } catch (error: any) {
    logger.error(`[services.ts] Toggle command failed for ${action} ${filename}`);
    logger.error(`[services.ts] Error: ${error.message}`);
    return {
      success: false,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      error: error.message,
    };
  }
}

/**
 * Read a log file for a service
 * @param pathToLogs - The directory path where logs are stored
 * @param name - The service name (used to construct {name}.log)
 * @returns Object with success status and log content or error message
 */
export async function readLogFile(
  pathToLogs: string,
  name: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const logFilePath = path.join(pathToLogs, `${name}.log`);
  logger.info(`[services.ts] Reading log file: ${logFilePath}`);

  try {
    // Check if directory exists
    try {
      await fs.access(pathToLogs);
    } catch (error) {
      logger.error(`[services.ts] Directory does not exist: ${pathToLogs}`);
      return {
        success: false,
        error: `Log directory does not exist: ${pathToLogs}`,
      };
    }

    // Check if log file exists
    try {
      await fs.access(logFilePath);
    } catch (error) {
      logger.error(`[services.ts] Log file does not exist: ${logFilePath}`);
      return {
        success: false,
        error: `Log file does not exist: ${logFilePath}`,
      };
    }

    // Read the log file
    const content = await fs.readFile(logFilePath, "utf8");
    logger.info(`[services.ts] Successfully read log file, size: ${content.length} bytes`);
    return { success: true, content };
  } catch (error: any) {
    logger.error(`[services.ts] Error reading log file: ${error.message}`);
    return {
      success: false,
      error: `Permission error or failed to read log file: ${error.message}`,
    };
  }
}
