import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Execute a systemctl status command and return the output
 * @param filename - The service or timer filename (e.g., "myapp.service")
 * @returns Promise with stdout and stderr
 */
export async function executeSystemctlStatus(
  filename: string
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(
      `sudo systemctl status ${filename}`
    );
    return { stdout, stderr };
  } catch (error: any) {
    // systemctl returns non-zero exit code for inactive services
    // We still want to capture the output
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
  const lines = output.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("Active:")) {
      // Extract everything after "Active: "
      const status = trimmedLine.replace(/^Active:\s*/, "");
      return status;
    }
  }
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
  const lines = output.split("\n");
  let timerStatus = "unknown";
  let timerTrigger = "unknown";

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("Active:")) {
      timerStatus = trimmedLine.replace(/^Active:\s*/, "");
    }

    if (trimmedLine.startsWith("Trigger:")) {
      timerTrigger = trimmedLine.replace(/^Trigger:\s*/, "");
    }
  }

  return { timerStatus, timerTrigger };
}

/**
 * Get the status of a service by executing systemctl status command
 * @param filename - The service filename (e.g., "myapp.service")
 * @returns The service status string
 */
export async function getServiceStatus(filename: string): Promise<string> {
  const { stdout } = await executeSystemctlStatus(filename);
  return parseServiceStatus(stdout);
}

/**
 * Get the timer status and trigger for a service timer
 * @param filenameTimer - The timer filename (e.g., "myapp.timer")
 * @returns Object with timerStatus and timerTrigger
 */
export async function getTimerStatusAndTrigger(
  filenameTimer: string
): Promise<{ timerStatus: string; timerTrigger: string }> {
  const { stdout } = await executeSystemctlStatus(filenameTimer);
  return parseTimerStatus(stdout);
}
