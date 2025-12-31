# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Server Manager API is a TypeScript/Express.js application that runs on individual Ubuntu servers to provide RESTful APIs for server management. Each server instance connects to a shared MongoDB database and uses JWT authentication. The system manages:

- Nginx configurations (parsing, generating from templates, directory scanning)
- DNS records via Porkbun API (create, read, delete)
- Server logs and machine metadata
- Multi-machine coordination through centralized MongoDB

This API is designed to be consumed by a Next.js frontend dashboard that orchestrates multiple server instances.

## Development Commands

### Running the Application

```bash
npm run dev          # Development mode with hot reload (nodemon + ts-node)
npm run build        # Compile TypeScript to dist/ (includes template copying)
npm start            # Production mode (runs compiled dist/server.js)
```

### Testing

```bash
npm test             # Run all tests with Jest
npm run test:watch   # Watch mode for test development
```

Tests are located in `__tests__` subdirectories alongside source files (e.g., `src/models/__tests__/nginxFile.test.ts`).

## Architecture

### Application Structure

**Entry Point Flow:**

1. `src/server.ts` - Initializes Express server, sets up global error handlers, overrides console logging with NAME_APP prefix
2. `src/app.ts` - Configures middleware (CORS, JSON parsing, cookie-parser, morgan), registers routes, runs startup functions
3. Routes are mounted at: `/users`, `/machines`, `/nginx`, `/admin`, `/registrar`, `/`

**Startup Sequence (src/app.ts):**

- `verifyCheckDirectoryExists()` - Ensures required directories exist based on .env paths
- `connectDB()` - MongoDB connection initialization
- `onStartUpCreateEnvUsers()` - Creates admin users from ADMIN_EMAIL env variable if they don't exist

### Authentication & Authorization

All protected routes use `authenticateToken` middleware (src/modules/authentication.ts):

- Expects JWT in `Authorization: Bearer <token>` header
- Stores decoded user in `req.user`
- Can be disabled via `AUTHENTIFICATION_TURNED_OFF=true` env variable (development only)

User model includes `isAdmin` boolean for role-based access control.

### Key Domain Models

**Machine** (src/models/machine.ts):

- Represents a physical/virtual server in the network
- Tracks `machineName`, `urlApiForTsmNetwork`, `localIpAddress`, `userHomeDir`, `nginxStoragePathOptions`
- Referenced by NginxFile to link apps to their host servers

**NginxFile** (src/models/nginxFile.ts):

- Represents nginx configuration files tracked in MongoDB
- References TWO machines: `appHostServerMachineId` (where app runs) and `nginxHostServerMachineId` (where nginx runs)
- Stores `serverName`, `portNumber`, `framework`, `storeDirectory`
- Can have `serverNameArrayOfAdditionalServerNames` for multi-domain configs

**User** (src/models/user.ts):

- Standard user model with bcrypt-hashed passwords
- Fields: `email` (unique), `username`, `password`, `isAdmin`

### Nginx Management

**Template System:**
Templates are stored in `src/templates/nginxConfigFiles/` with placeholder syntax:

- `<ReplaceMe: server name>` - Replaced with space-separated server names
- `<ReplaceMe: local ip>` - Replaced with machine's local IP
- `<ReplaceMe: port number>` - Replaced with application port

Available templates:

- `expressJsConfd.txt` / `expressJsSitesAvailable.txt` - Express.js apps
- `nextJsConfd.txt` / `nextJsPythonSitesAvailable.txt` - Next.js apps
- `pythonConfd.txt` - Python apps

**Template Processing:**
The `createNginxConfigFromTemplate()` function (src/modules/nginx.ts) handles:

1. Reading template file
2. Replacing all placeholders
3. Writing to specified destination directory
4. Default filename: `<primaryServerName>.conf`

**Directory Scanning:**
`/nginx/scan-nginx-dir` endpoint scans the local nginx directory (from PATH_ETC_NGINX_SITES_AVAILABLE env var), parses configs using `parseNginxConfig()`, and generates reports via `generateNginxScanReport()`.

### Porkbun DNS Management

Registrar routes (src/routes/registrar.ts) integrate with Porkbun API v3:

- Requires `PORKBUN_API_KEY` and `PORKBUN_SECRET_KEY` in .env
- Endpoints follow pattern: fetch domains, create/delete DNS records
- Error responses distinguish between `errorFrom: "porkbun"` vs `errorFrom: "The Server Manager"`

### Environment Configuration

Critical .env variables:

- `MONGODB_URI` - Shared database connection string
- `JWT_SECRET` - Token signing key (must match across all instances)
- `ADMIN_EMAIL` - JSON array of admin emails created on startup
- `PATH_PROJECT_RESOURCES` - Directory for storing generated configs
- `PATH_ETC_NGINX_SITES_AVAILABLE` - Nginx config directory to scan
- `PATH_TO_LOGS` - Application log directory
- `PORKBUN_API_KEY` / `PORKBUN_SECRET_KEY` - DNS management credentials
- `URL_THE_SERVER_MANAGER_WEB` - Frontend dashboard URL for CORS

## Build Process

The `npm run build` command:

1. Compiles TypeScript (`tsc`)
2. Copies templates to `dist/` using `copyfiles -u 1 "src/templates/**/*" dist`

Templates must be in `dist/` for production since the code reads from `path.resolve(__dirname, "../templates/...")` relative to compiled JS files.

## Common Patterns

### Error Response Format

All API errors should return a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE_HERE",
    "message": "User-facing error message",
    "details": "Additional context (optional)",
    "status": 500
  }
}
```

**Field Definitions:**

- `code` - Machine-readable identifier (uppercase with underscores, e.g., `MACHINE_NOT_FOUND`, `VALIDATION_ERROR`)
- `message` - Human-readable summary for users (concise and clear)
- `details` - Optional additional context (include in development, sanitize in production)
- `status` - HTTP status code matching the response header

**Express.js Implementation:**

```typescript
// Single error
res.status(404).json({
  error: {
    code: "MACHINE_NOT_FOUND",
    message: "Machine not found",
    details: process.env.NODE_ENV === "development" ? error.message : undefined,
    status: 404,
  },
});

// Validation errors
res.status(400).json({
  error: {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    status: 400,
    details: [
      { field: "email", message: "Invalid email format" },
      { field: "port", message: "Must be a number" },
    ],
  },
});
```

**Common Error Codes:**

- `VALIDATION_ERROR` - Invalid request data (400)
- `AUTH_FAILED` - Authentication failure (401)
- `FORBIDDEN` - Insufficient permissions (403)
- `NOT_FOUND` - Resource doesn't exist (404)
- `INTERNAL_ERROR` - Server error (500)

**Security Guidelines:**

- Never expose in production: stack traces, database errors, file paths, internal system details
- Always include HTTP status in both response header and error body
- Log detailed errors server-side, return sanitized versions to clients

### Route Parameter Validation

Use `checkBodyReturnMissing(req.body, ["field1", "field2"])` to validate required fields before processing.

### Machine Identification

Many operations use `getMachineInfo()` to get the current server's local IP, then query `Machine.findOne({ localIpAddress })` to identify the machine context.

## Testing Strategy

Jest is configured with:

- `ts-jest` preset for TypeScript
- `mongodb-memory-server` for database testing (see package.json devDependencies)
- Tests in `__tests__` folders or `*.test.ts` / `*.spec.ts` files
- Coverage excludes `*.d.ts` and `server.ts`
