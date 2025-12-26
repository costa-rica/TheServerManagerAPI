import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

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
  console.log(`[services.ts] Executing command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`[services.ts] Command succeeded for ${filename}`);
    console.log(`[services.ts] stdout length: ${stdout.length} chars`);
    if (stderr) {
      console.warn(`[services.ts] stderr for ${filename}: ${stderr}`);
    }
    return { stdout, stderr };
  } catch (error: any) {
    // systemctl returns non-zero exit code for inactive services
    // We still want to capture the output
    console.warn(`[services.ts] Command failed with non-zero exit for ${filename}`);
    console.log(`[services.ts] Error code: ${error.code}`);
    console.log(`[services.ts] Error message: ${error.message}`);
    console.log(`[services.ts] stdout length: ${error.stdout?.length || 0} chars`);
    console.log(`[services.ts] stderr: ${error.stderr || 'none'}`);

    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
    };
  }
}

/**
 * Parse the "Active" status from systemctl status output
 * @param output - The stdout from systemctl status command
 * @returns The active status (e.g., "active (running)", "inactive (dead)")
 */
export function parseServiceStatus(output: string): string {
  console.log(`[services.ts] Parsing service status from ${output.length} chars of output`);

  if (!output || output.trim().length === 0) {
    console.warn(`[services.ts] Output is empty, cannot parse status`);
    return "unknown";
  }

  const lines = output.split("\n");
  console.log(`[services.ts] Output has ${lines.length} lines`);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("Active:")) {
      // Extract everything after "Active: "
      const status = trimmedLine.replace(/^Active:\s*/, "");
      console.log(`[services.ts] Found Active status: ${status}`);
      return status;
    }
  }

  console.warn(`[services.ts] No "Active:" line found in output`);
  console.log(`[services.ts] First 200 chars of output: ${output.substring(0, 200)}`);
  return "unknown";
}

/**
 * Parse the timer status and trigger from systemctl status output for a timer
 * @param output - The stdout from systemctl status command for a timer
 * @returns Object with timerStatus and timerTrigger
 */
export function parseTimerStatus(output: string): {
  timerStatus: string;
  timerTrigger: string;
} {
  console.log(`[services.ts] Parsing timer status from ${output.length} chars of output`);

  if (!output || output.trim().length === 0) {
    console.warn(`[services.ts] Timer output is empty, cannot parse`);
    return { timerStatus: "unknown", timerTrigger: "unknown" };
  }

  const lines = output.split("\n");
  let timerStatus = "unknown";
  let timerTrigger = "unknown";

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("Active:")) {
      timerStatus = trimmedLine.replace(/^Active:\s*/, "");
      console.log(`[services.ts] Found timer Active status: ${timerStatus}`);
    }

    if (trimmedLine.startsWith("Trigger:")) {
      timerTrigger = trimmedLine.replace(/^Trigger:\s*/, "");
      console.log(`[services.ts] Found timer Trigger: ${timerTrigger}`);
    }
  }

  if (timerStatus === "unknown" || timerTrigger === "unknown") {
    console.warn(`[services.ts] Could not find Active or Trigger in timer output`);
    console.log(`[services.ts] First 200 chars of timer output: ${output.substring(0, 200)}`);
  }

  return { timerStatus, timerTrigger };
}

/**
 * Get the status of a service by executing systemctl status command
 * @param filename - The service filename (e.g., "myapp.service")
 * @returns The service status string
 */
export async function getServiceStatus(filename: string): Promise<string> {
  console.log(`[services.ts] Getting service status for: ${filename}`);
  const { stdout } = await executeSystemctlStatus(filename);
  const status = parseServiceStatus(stdout);
  console.log(`[services.ts] Final status for ${filename}: ${status}`);
  return status;
}

/**
 * Get the timer status and trigger for a service timer
 * @param filenameTimer - The timer filename (e.g., "myapp.timer")
 * @returns Object with timerStatus and timerTrigger
 */
export async function getTimerStatusAndTrigger(
  filenameTimer: string
): Promise<{ timerStatus: string; timerTrigger: string }> {
  console.log(`[services.ts] Getting timer status for: ${filenameTimer}`);
  const { stdout } = await executeSystemctlStatus(filenameTimer);
  const result = parseTimerStatus(stdout);
  console.log(`[services.ts] Final timer status for ${filenameTimer}: ${JSON.stringify(result)}`);
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
  console.log(`[services.ts] Executing toggle command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`[services.ts] Toggle command succeeded for ${action} ${filename}`);
    return { success: true, stdout, stderr };
  } catch (error: any) {
    console.error(`[services.ts] Toggle command failed for ${action} ${filename}`);
    console.error(`[services.ts] Error: ${error.message}`);
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
  console.log(`[services.ts] Reading log file: ${logFilePath}`);

  try {
    // Check if directory exists
    try {
      await fs.access(pathToLogs);
    } catch (error) {
      console.error(`[services.ts] Directory does not exist: ${pathToLogs}`);
      return {
        success: false,
        error: `Log directory does not exist: ${pathToLogs}`,
      };
    }

    // Check if log file exists
    try {
      await fs.access(logFilePath);
    } catch (error) {
      console.error(`[services.ts] Log file does not exist: ${logFilePath}`);
      return {
        success: false,
        error: `Log file does not exist: ${logFilePath}`,
      };
    }

    // Read the log file
    const content = await fs.readFile(logFilePath, "utf8");
    console.log(`[services.ts] Successfully read log file, size: ${content.length} bytes`);
    return { success: true, content };
  } catch (error: any) {
    console.error(`[services.ts] Error reading log file: ${error.message}`);
    return {
      success: false,
      error: `Permission error or failed to read log file: ${error.message}`,
    };
  }
}
