import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

const BASE_APPLICATIONS_PATH = "/home/nick/applications";

/**
 * Execute a git command in the specified project directory
 * @param projectName - The service name (used to construct the path)
 * @param gitCommand - The git command to execute (e.g., "branch -r", "fetch", "pull")
 * @returns Promise with stdout and stderr
 */
export async function executeGitCommand(
  projectName: string,
  gitCommand: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  const projectPath = path.join(BASE_APPLICATIONS_PATH, projectName);
  const command = `cd "${projectPath}" && git ${gitCommand}`;

  console.log(`[git.ts] Executing git command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`[git.ts] Git command succeeded for ${projectName}`);
    console.log(`[git.ts] stdout length: ${stdout.length} chars`);
    if (stderr) {
      console.warn(`[git.ts] stderr: ${stderr}`);
    }
    return { success: true, stdout, stderr };
  } catch (error: any) {
    console.error(`[git.ts] Git command failed for ${projectName}`);
    console.error(`[git.ts] Error: ${error.message}`);
    return {
      success: false,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      error: error.message,
    };
  }
}

/**
 * Get list of local branches for a repository
 * @param projectName - The service name
 * @returns Promise with array of local branch names
 */
export async function getLocalBranches(
  projectName: string
): Promise<{ success: boolean; branches: string[]; error?: string }> {
  console.log(`[git.ts] Getting local branches for: ${projectName}`);

  const result = await executeGitCommand(projectName, "branch");

  if (!result.success) {
    return { success: false, branches: [], error: result.error };
  }

  // Parse branch names from output
  // Output looks like: "  main\n* dev\n  feature-branch\n"
  // The asterisk (*) marks the currently checked out branch
  const branches = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line) // Filter out empty lines
    .map((line) => line.replace(/^\*\s*/, "")); // Remove asterisk from current branch

  console.log(`[git.ts] Found ${branches.length} local branches`);
  return { success: true, branches };
}

/**
 * Get list of remote branches for a repository
 * @param projectName - The service name
 * @returns Promise with array of remote branch names
 */
export async function getRemoteBranches(
  projectName: string
): Promise<{ success: boolean; branches: string[]; error?: string }> {
  console.log(`[git.ts] Getting remote branches for: ${projectName}`);

  const result = await executeGitCommand(projectName, "branch -r");

  if (!result.success) {
    return { success: false, branches: [], error: result.error };
  }

  // Parse remote branch names from output
  // Output looks like: "  origin/main\n  origin/dev\n  origin/HEAD -> origin/main\n"
  const branches = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("->")) // Filter empty lines and HEAD pointer
    .map((line) => line.replace(/^origin\//, "")); // Remove "origin/" prefix for cleaner display

  console.log(`[git.ts] Found ${branches.length} remote branches`);
  return { success: true, branches };
}

/**
 * Execute git fetch
 * @param projectName - The service name
 * @returns Promise with success status
 */
export async function gitFetch(
  projectName: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  console.log(`[git.ts] Executing git fetch for: ${projectName}`);
  return executeGitCommand(projectName, "fetch");
}

/**
 * Execute git pull
 * @param projectName - The service name
 * @returns Promise with success status
 */
export async function gitPull(
  projectName: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  console.log(`[git.ts] Executing git pull for: ${projectName}`);
  return executeGitCommand(projectName, "pull");
}

/**
 * Execute git checkout to switch branches
 * @param projectName - The service name
 * @param branchName - The branch name to checkout
 * @returns Promise with success status
 */
export async function gitCheckout(
  projectName: string,
  branchName: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  console.log(
    `[git.ts] Executing git checkout ${branchName} for: ${projectName}`
  );
  return executeGitCommand(projectName, `checkout ${branchName}`);
}

/**
 * Get the current branch name
 * @param projectName - The service name
 * @returns Promise with current branch name
 */
export async function getCurrentBranch(
  projectName: string
): Promise<{ success: boolean; currentBranch: string; error?: string }> {
  console.log(`[git.ts] Getting current branch for: ${projectName}`);

  const result = await executeGitCommand(projectName, "branch --show-current");

  if (!result.success) {
    return { success: false, currentBranch: "", error: result.error };
  }

  const currentBranch = result.stdout.trim();
  console.log(`[git.ts] Current branch: ${currentBranch}`);
  return { success: true, currentBranch };
}

/**
 * Delete a branch using git branch -D
 * @param projectName - The service name
 * @param branchName - The branch name to delete
 * @returns Promise with success status
 */
export async function deleteBranch(
  projectName: string,
  branchName: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  console.log(`[git.ts] Deleting branch ${branchName} for: ${projectName}`);
  return executeGitCommand(projectName, `branch -D ${branchName}`);
}
