import fs from "fs/promises";
import path from "path";

const TEMPLATES_PATH = path.resolve(__dirname, "../templates/systemdServiceFiles");

/**
 * Valid service template filenames
 */
export const VALID_SERVICE_TEMPLATES = [
  "expressjs.service",
  "flask.service",
  "nodejsscript.service",
  "pythonscript.service",
  "fastapi.service",
  "nextjs.service",
] as const;

/**
 * Valid timer template filenames
 */
export const VALID_TIMER_TEMPLATES = [
  "nodejsscript.timer",
  "pythonscript.timer",
] as const;

export type ServiceTemplate = (typeof VALID_SERVICE_TEMPLATES)[number];
export type TimerTemplate = (typeof VALID_TIMER_TEMPLATES)[number];

/**
 * Template variables for replacing placeholders
 */
export interface TemplateVariables {
  project_name: string;
  python_env_name?: string;
  port?: number;
  project_name_lowercase?: string;
}

/**
 * Replace template placeholders with actual values
 * @param templateContent - The template file content
 * @param variables - Variables to replace placeholders with
 * @returns Processed content with placeholders replaced
 */
export function replaceTemplatePlaceholders(
  templateContent: string,
  variables: TemplateVariables
): string {
  let content = templateContent;

  // Replace {{PROJECT_NAME}}
  if (variables.project_name) {
    content = content.replace(/\{\{PROJECT_NAME\}\}/g, variables.project_name);
  }

  // Replace {{PROJECT_NAME_LOWERCASE}}
  if (variables.project_name_lowercase) {
    content = content.replace(
      /\{\{PROJECT_NAME_LOWERCASE\}\}/g,
      variables.project_name_lowercase
    );
  }

  // Replace {{PYTHON_ENV_NAME}}
  if (variables.python_env_name) {
    content = content.replace(
      /\{\{PYTHON_ENV_NAME\}\}/g,
      variables.python_env_name
    );
  }

  // Replace {{PORT}}
  if (variables.port !== undefined) {
    content = content.replace(/\{\{PORT\}\}/g, variables.port.toString());
  }

  return content;
}

/**
 * Read a template file from the templates directory
 * @param templateFilename - Name of the template file (e.g., "expressjs.service")
 * @returns Promise with the template file content
 */
export async function readTemplateFile(
  templateFilename: string
): Promise<string> {
  const templatePath = path.join(TEMPLATES_PATH, templateFilename);
  console.log(`[systemd.ts] Reading template file: ${templatePath}`);

  try {
    const content = await fs.readFile(templatePath, "utf-8");
    console.log(`[systemd.ts] Successfully read template: ${templateFilename}`);
    return content;
  } catch (error: any) {
    console.error(`[systemd.ts] Error reading template file: ${error.message}`);
    throw new Error(`Failed to read template file: ${templateFilename}`);
  }
}

/**
 * Write a service or timer file to the specified path
 * @param outputPath - Full path where the file should be written
 * @param content - The processed service/timer file content
 * @returns Promise that resolves when file is written
 */
export async function writeServiceFile(
  outputPath: string,
  content: string
): Promise<void> {
  console.log(`[systemd.ts] Writing service file to: ${outputPath}`);

  try {
    await fs.writeFile(outputPath, content, "utf-8");
    console.log(`[systemd.ts] Successfully wrote file: ${outputPath}`);
  } catch (error: any) {
    console.error(`[systemd.ts] Error writing service file: ${error.message}`);
    throw new Error(`Failed to write service file to: ${outputPath}`);
  }
}

/**
 * Process a template and generate a service/timer file
 * @param templateFilename - Name of the template file
 * @param variables - Variables to replace in the template
 * @param outputDirectory - Directory where the file should be written
 * @param outputFilename - Name of the output file
 * @returns Promise with the output path and processed content
 */
export async function generateServiceFile(
  templateFilename: string,
  variables: TemplateVariables,
  outputDirectory: string,
  outputFilename: string
): Promise<{ outputPath: string; content: string }> {
  console.log(
    `[systemd.ts] Generating service file from template: ${templateFilename}`
  );

  // Read the template
  const templateContent = await readTemplateFile(templateFilename);

  // Replace placeholders
  const processedContent = replaceTemplatePlaceholders(
    templateContent,
    variables
  );

  // Construct output path
  const outputPath = path.join(outputDirectory, outputFilename);

  // Write the file
  await writeServiceFile(outputPath, processedContent);

  console.log(`[systemd.ts] Successfully generated: ${outputPath}`);

  return {
    outputPath,
    content: processedContent,
  };
}
