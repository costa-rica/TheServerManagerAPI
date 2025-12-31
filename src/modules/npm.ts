import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

const BASE_APPLICATIONS_PATH = "/home/nick/applications";

/**
 * Parse npm command output to extract warnings
 * @param stdout - Standard output from npm command
 * @param stderr - Standard error from npm command
 * @returns Array of warning messages
 */
function parseWarnings(stdout: string, stderr: string): string[] {
  const warnings: string[] = [];
  const combinedOutput = stdout + "\n" + stderr;

  // Split into lines and look for warning patterns
  const lines = combinedOutput.split("\n");

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    // Look for lines containing "warn", "warning", "deprecated"
    if (lowerLine.includes("warn") || lowerLine.includes("deprecated")) {
      warnings.push(line.trim());
    }
  }

  return warnings;
}

/**
 * Parse npm command error to extract failure reason
 * @param error - Error object from exec
 * @param stderr - Standard error from npm command
 * @returns Failure reason string
 */
function parseFailureReason(error: any, stderr: string): string {
  // Check stderr first
  if (stderr && stderr.trim()) {
    // Look for error messages in stderr
    const lines = stderr.split("\n").filter(line => line.trim());
    // Return first few non-empty lines as failure reason
    return lines.slice(0, 3).join("\n");
  }

  // Fall back to error message
  if (error && error.message) {
    return error.message;
  }

  return "Unknown error occurred";
}

/**
 * Execute npm install in a project directory
 * @param projectName - The service name (used to construct the path)
 * @returns Promise with status, warnings, and failureReason
 */
export async function npmInstall(
  projectName: string
): Promise<{ status: "success" | "fail"; warnings: string; failureReason: string | null }> {
  const projectPath = path.join(BASE_APPLICATIONS_PATH, projectName);
  const command = `cd "${projectPath}" && npm install`;

  console.log(`[npm.ts] Executing npm install for: ${projectName}`);
  console.log(`[npm.ts] Command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer

    console.log(`[npm.ts] npm install succeeded for ${projectName}`);

    // Parse warnings even on success
    const warningsList = parseWarnings(stdout, stderr);
    const warnings = warningsList.length > 0 ? warningsList.join("\n") : "no warnings";

    console.log(`[npm.ts] Found ${warningsList.length} warnings`);

    return {
      status: "success",
      warnings,
      failureReason: null
    };
  } catch (error: any) {
    console.error(`[npm.ts] npm install failed for ${projectName}`);
    console.error(`[npm.ts] Error: ${error.message}`);

    const stdout = error.stdout || "";
    const stderr = error.stderr || "";

    // Parse warnings even on failure
    const warningsList = parseWarnings(stdout, stderr);
    const warnings = warningsList.length > 0 ? warningsList.join("\n") : "no warnings";

    // Parse failure reason
    const failureReason = parseFailureReason(error, stderr);

    return {
      status: "fail",
      warnings,
      failureReason
    };
  }
}

/**
 * Execute npm run build in a project directory
 * @param projectName - The service name (used to construct the path)
 * @returns Promise with status, warnings, and failureReason
 */
export async function npmBuild(
  projectName: string
): Promise<{ status: "success" | "fail"; warnings: string; failureReason: string | null }> {
  const projectPath = path.join(BASE_APPLICATIONS_PATH, projectName);
  const command = `cd "${projectPath}" && npm run build`;

  console.log(`[npm.ts] Executing npm run build for: ${projectName}`);
  console.log(`[npm.ts] Command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer

    console.log(`[npm.ts] npm run build succeeded for ${projectName}`);

    // Parse warnings even on success
    const warningsList = parseWarnings(stdout, stderr);
    const warnings = warningsList.length > 0 ? warningsList.join("\n") : "no warnings";

    console.log(`[npm.ts] Found ${warningsList.length} warnings`);

    return {
      status: "success",
      warnings,
      failureReason: null
    };
  } catch (error: any) {
    console.error(`[npm.ts] npm run build failed for ${projectName}`);
    console.error(`[npm.ts] Error: ${error.message}`);

    const stdout = error.stdout || "";
    const stderr = error.stderr || "";

    // Parse warnings even on failure
    const warningsList = parseWarnings(stdout, stderr);
    const warnings = warningsList.length > 0 ? warningsList.join("\n") : "no warnings";

    // Parse failure reason
    const failureReason = parseFailureReason(error, stderr);

    return {
      status: "fail",
      warnings,
      failureReason
    };
  }
}
