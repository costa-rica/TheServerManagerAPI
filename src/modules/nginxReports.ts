import fs from "fs";
import path from "path";
import logger from "../config/logger";

interface ScanEntry {
  fileName: string;
  status: "success" | "fail";
  errorMessage?: string;
  serverName?: string;
  portNumber?: number;
  localIpAddress?: string;
}

/**
 * Generates a CSV report from nginx config file scan results
 * @param newEntries - Successfully scanned entries
 * @param duplicates - Duplicate entries that were skipped
 * @param errors - Entries that failed to parse
 * @returns Path to the generated CSV file
 */
export function generateNginxScanReport(
  newEntries: any[],
  duplicates: any[],
  errors: any[]
): string {
  const statusReportsDir = path.join(
    process.env.PATH_PROJECT_RESOURCES || "",
    "status_reports"
  );

  // Ensure directory exists
  if (!fs.existsSync(statusReportsDir)) {
    fs.mkdirSync(statusReportsDir, { recursive: true });
  }

  // Prepare CSV data
  const csvRows: string[] = [];

  // Header
  csvRows.push(
    "id,fileName,status,errorMessage,serverName,portNumber,localIpAddress"
  );

  let id = 1;

  // Add successful entries
  for (const entry of newEntries) {
    const row = [
      id++,
      entry.fileName,
      "success",
      "",
      entry.serverName || "",
      entry.portNumber || "",
      entry.localIpAddress || "",
    ];
    csvRows.push(row.map((val) => `"${val}"`).join(","));
  }

  // Add duplicate entries (also successful scans, just not inserted)
  for (const entry of duplicates) {
    const row = [
      id++,
      entry.fileName,
      "success",
      entry.reason || "Duplicate entry",
      entry.serverName || "",
      entry.portNumber || "",
      entry.localIpAddress || "",
    ];
    csvRows.push(row.map((val) => `"${val}"`).join(","));
  }

  // Add error entries
  for (const entry of errors) {
    const row = [
      id++,
      entry.fileName,
      "fail",
      entry.error || "Unknown error",
      "",
      "",
      "",
    ];
    csvRows.push(row.map((val) => `"${val}"`).join(","));
  }

  // Write to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `nginxConfigFileScanStatusSummary_${timestamp}.csv`;
  const filePath = path.join(statusReportsDir, fileName);

  fs.writeFileSync(filePath, csvRows.join("\n"), "utf-8");

  logger.info(`📊 Nginx scan report saved: ${filePath}`);

  return filePath;
}
