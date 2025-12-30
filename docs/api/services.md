# Service Routes

Service management endpoints for monitoring and controlling systemd services on Ubuntu servers.

---

## GET /services

Get the status of all services running on the current server. Queries Ubuntu systemd to retrieve real-time status information for each service configured in the machine's servicesArray.

**Authentication:** Required (JWT token)

**Environment:** Production only (Ubuntu OS with systemd)

**Sample Request:**

```bash
curl --location 'http://localhost:3000/services' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "servicesStatusArray": [
    {
      "name": "PersonalWeb03 API",
      "filename": "personalweb03-api.service",
      "loaded": "loaded (/etc/systemd/system/personalweb03-api.service; enabled; preset: enabled)",
      "active": "active (running) since Thu 2025-12-25 10:30:00 UTC; 2h ago",
      "status": "active",
      "onStartStatus": "enabled"
    },
    {
      "name": "PersonalWeb03 Services",
      "filename": "personalweb03-services.service",
      "loaded": "loaded (/etc/systemd/system/personalweb03-services.service; disabled; preset: enabled)",
      "active": "inactive (dead) since Thu 2025-12-25 19:19:14 UTC; 5min ago",
      "status": "inactive",
      "onStartStatus": "disabled",
      "timerLoaded": "loaded (/etc/systemd/system/personalweb03-services.timer; enabled; preset: enabled)",
      "timerActive": "active (waiting) since Thu 2025-12-25 19:19:04 UTC; 4min 40s ago",
      "timerStatus": "active",
      "timerOnStartStatus": "enabled",
      "timerTrigger": "Thu 2025-12-25 23:00:00 UTC; 3h 36min left"
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `servicesStatusArray` | Object[] | Array of service status objects |
| `servicesStatusArray[].name` | String | Human-readable service name from servicesArray |
| `servicesStatusArray[].filename` | String | Systemd service filename |
| `servicesStatusArray[].loaded` | String | Full "Loaded:" line from systemctl status showing file path and enabled/disabled state |
| `servicesStatusArray[].active` | String | Full "Active:" line from systemctl status (e.g., "active (running) since...", "inactive (dead) since...") |
| `servicesStatusArray[].status` | String | Simplified status: "active", "inactive", "failed", "activating", "deactivating", or "unknown" |
| `servicesStatusArray[].onStartStatus` | String | Whether service starts on boot: "enabled", "disabled", "static", or "unknown" (parsed from loaded line) |
| `servicesStatusArray[].timerLoaded` | String | Full "Loaded:" line from timer's systemctl status (optional, only if filenameTimer configured) |
| `servicesStatusArray[].timerActive` | String | Full "Active:" line from timer's systemctl status (optional, only if filenameTimer configured) |
| `servicesStatusArray[].timerStatus` | String | Simplified timer status: "active", "inactive", or "unknown" (optional, only if filenameTimer configured) |
| `servicesStatusArray[].timerOnStartStatus` | String | Whether timer starts on boot: "enabled", "disabled", "static", or "unknown" (optional, only if filenameTimer configured) |
| `servicesStatusArray[].timerTrigger` | String | Next trigger time (optional, only if filenameTimer configured) |

**Error Response (400 Bad Request - Not Production):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "This endpoint only works in production environment on Ubuntu OS",
    "status": 400
  }
}
```

**Error Response (404 Not Found - Machine Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Machine not found in database",
    "details": "Machine with name \"ubuntu-server-01\" not found in database",
    "status": 404
  }
}
```

**Error Response (404 Not Found - No Services):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No services configured for this machine",
    "details": "Machine \"ubuntu-server-01\" has no services configured in servicesArray",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to fetch services status",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Retrieves machine's servicesArray using OS hostname from `getMachineInfo()`
- Executes `sudo systemctl status {filename}` for each service
- Parses systemctl output to extract multiple fields:
  - **Loaded:** Full "Loaded:" line containing file path and enabled/disabled state
  - **Active:** Full "Active:" line with detailed status and timestamp
  - **Status:** Simplified state extracted from Active line (active/inactive/failed/etc.)
  - **onStartStatus:** Parsed from Loaded line to determine if service is enabled/disabled/static
- If service has `filenameTimer`, also executes `sudo systemctl status {filenameTimer}` and extracts:
  - **timerLoaded:** Full "Loaded:" line from timer with file path and enabled/disabled state
  - **timerActive:** Full "Active:" line from timer with detailed status and timestamp
  - **timerStatus:** Simplified timer state (active/inactive/etc.)
  - **timerOnStartStatus:** Whether timer starts on boot (enabled/disabled/static)
  - **timerTrigger:** Next scheduled trigger time
- Services with errors return all fields as `"unknown"` but don't fail entire request
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers with systemd

---

## POST /services/:serviceFilename/:toggleStatus

Control a service by starting, stopping, restarting, or performing other systemctl actions.

**Authentication:** Required (JWT token)

**Environment:** Production only (Ubuntu OS with systemd)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serviceFilename` | String | Yes | Service or timer filename (e.g., "personalweb03-api.service" or "personalweb03-services.timer") |
| `toggleStatus` | String | Yes | Action to perform: start, stop, restart, reload, enable, disable |

**Sample Request:**

```bash
curl --location --request POST 'http://localhost:3000/services/personalweb03-api.service/start' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "name": "PersonalWeb03 API",
  "filename": "personalweb03-api.service",
  "loaded": "loaded (/etc/systemd/system/personalweb03-api.service; enabled; preset: enabled)",
  "active": "active (running) since Thu 2025-12-26 14:22:00 UTC; 2s ago",
  "status": "active",
  "onStartStatus": "enabled"
}
```

**Success Response with Timer (200 OK):**

```json
{
  "name": "PersonalWeb03 Services",
  "filename": "personalweb03-services.service",
  "loaded": "loaded (/etc/systemd/system/personalweb03-services.service; disabled; preset: enabled)",
  "active": "inactive (dead) since Thu 2025-12-25 19:19:14 UTC; 5min ago",
  "status": "inactive",
  "onStartStatus": "disabled",
  "timerLoaded": "loaded (/etc/systemd/system/personalweb03-services.timer; enabled; preset: enabled)",
  "timerActive": "active (waiting) since Thu 2025-12-25 19:19:04 UTC; 4min 40s ago",
  "timerStatus": "active",
  "timerOnStartStatus": "enabled",
  "timerTrigger": "Thu 2025-12-25 23:00:00 UTC; 3h 36min left"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Human-readable service name from servicesArray |
| `filename` | String | Systemd service filename |
| `loaded` | String | Full "Loaded:" line from systemctl status showing file path and enabled/disabled state |
| `active` | String | Full "Active:" line from systemctl status after toggle operation |
| `status` | String | Simplified status: "active", "inactive", "failed", etc. |
| `onStartStatus` | String | Whether service starts on boot: "enabled", "disabled", "static", or "unknown" |
| `timerLoaded` | String | Full "Loaded:" line from timer's systemctl status (optional, only if filenameTimer configured) |
| `timerActive` | String | Full "Active:" line from timer's systemctl status (optional, only if filenameTimer configured) |
| `timerStatus` | String | Simplified timer status: "active", "inactive", or "unknown" (optional, only if filenameTimer configured) |
| `timerOnStartStatus` | String | Whether timer starts on boot: "enabled", "disabled", "static", or "unknown" (optional, only if filenameTimer configured) |
| `timerTrigger` | String | Next trigger time (optional, only if filenameTimer configured) |

**Error Response (400 Bad Request - Not Production):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "This endpoint only works in production environment on Ubuntu OS",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Invalid Action):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid toggleStatus",
    "details": "Invalid toggleStatus. Must be one of: start, stop, restart, reload, enable, disable",
    "status": 400
  }
}
```

**Error Response (404 Not Found - Machine Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Machine not found in database",
    "details": "Machine with name \"ubuntu-server-01\" not found in database",
    "status": 404
  }
}
```

**Error Response (404 Not Found - No Services):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No services configured for this machine",
    "details": "Machine \"ubuntu-server-01\" has no services configured in servicesArray",
    "status": 404
  }
}
```

**Error Response (404 Not Found - Service Not Configured):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service not found",
    "details": "Service with filename \"personalweb03-api.service\" is not configured in this machine's servicesArray",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error - Command Failed):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to start service",
    "details": "Command 'sudo systemctl start personalweb03-api.service' failed with exit code 1 (only in development mode)",
    "status": 500
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to toggle service",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Accepts both `.service` and `.timer` filenames in the `serviceFilename` parameter
- Validates that `serviceFilename` exists in machine's servicesArray (checks both `filename` and `filenameTimer` fields)
- **Special handling for critical services:** `tsm-api.service` and `tsm-nextjs.service` always execute `restart` when `start`, `stop`, or `restart` is requested (other actions like `enable`, `disable`, `reload` work normally)
- Executes `sudo systemctl {toggleStatus} {serviceFilename}`
- Queries updated service status after toggle operation, including:
  - Full "Loaded:" and "Active:" lines from systemctl
  - Simplified status (active/inactive/failed/etc.)
  - Boot-time behavior (enabled/disabled/static)
- If service has `filenameTimer`, includes timer fields in response:
  - **timerLoaded:** Full "Loaded:" line from timer
  - **timerActive:** Full "Active:" line from timer
  - **timerStatus:** Simplified timer state (active/inactive/etc.)
  - **timerOnStartStatus:** Whether timer starts on boot (enabled/disabled/static)
  - **timerTrigger:** Next scheduled trigger time
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers with systemd
- Supported actions: start, stop, restart, reload, enable, disable

**Examples:**

Start a service:
```bash
POST /services/personalweb03-api.service/start
```

Stop a service:
```bash
POST /services/personalweb03-api.service/stop
```

Restart a service:
```bash
POST /services/personalweb03-api.service/restart
```

Enable a service to start on boot:
```bash
POST /services/personalweb03-api.service/enable
```

Start a timer:
```bash
POST /services/personalweb03-services.timer/start
```

Stop a timer:
```bash
POST /services/personalweb03-services.timer/stop
```

**Special handling for critical services (tsm-api.service and tsm-nextjs.service):**

Attempting to stop tsm-api (will execute restart instead):
```bash
POST /services/tsm-api.service/stop
# Automatically converted to: sudo systemctl restart tsm-api.service
```

Attempting to start tsm-nextjs (will execute restart instead):
```bash
POST /services/tsm-nextjs.service/start
# Automatically converted to: sudo systemctl restart tsm-nextjs.service
```

---

## GET /services/logs/:name

Retrieve the log file for a specific service.

**Authentication:** Required (JWT token)

**Environment:** Production only (Ubuntu OS)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | String | Yes | Service name (matches the `name` field in servicesArray) |

**Sample Request:**

```bash
curl --location 'http://localhost:3000/services/logs/PersonalWeb03 API' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```
Content-Type: text/plain

[2025-12-26 10:30:00] INFO: Application started
[2025-12-26 10:30:01] INFO: Connected to database
[2025-12-26 10:30:02] INFO: Server listening on port 3001
[2025-12-26 11:15:23] INFO: Request received: GET /api/users
[2025-12-26 11:15:24] INFO: Response sent: 200 OK
```

**Error Response (400 Bad Request - Not Production):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "This endpoint only works in production environment on Ubuntu OS",
    "status": 400
  }
}
```

**Error Response (404 Not Found - Machine Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Machine not found in database",
    "details": "Machine with name \"ubuntu-server-01\" not found in database",
    "status": 404
  }
}
```

**Error Response (404 Not Found - No Services):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No services configured for this machine",
    "details": "Machine \"ubuntu-server-01\" has no services configured in servicesArray",
    "status": 404
  }
}
```

**Error Response (404 Not Found - Service Not Configured):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service not found",
    "details": "Service with name \"PersonalWeb03 API\" is not configured in this machine's servicesArray",
    "status": 404
  }
}
```

**Error Response (404 Not Found - Log File Not Found or Permission Error):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Log file not found or could not be read",
    "details": "Log file error message (only in development mode)",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to read log file",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates that `name` matches a service in machine's servicesArray
- Looks up the service by name to get its `pathToLogs` field
- Constructs log file path as `{service.pathToLogs}/{name}.log`
- Returns entire log file content as plain text
- Checks directory existence before attempting to read file
- Provides explicit error messages for:
  - Directory doesn't exist
  - Log file doesn't exist
  - Permission errors
  - Service not found in servicesArray
- Only works when `NODE_ENV=production` on Ubuntu servers

**Notes:**

- The `name` parameter must match the `name` field (not `filename`) in servicesArray
- Response is plain text, not JSON
- Returns the entire log file without pagination or limits
- URL encode the service name if it contains spaces (e.g., "PersonalWeb03 API" → "PersonalWeb03%20API")

---

## GET /services/git/:name

Get the list of remote branches for a service's git repository.

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | String | Yes | Service name (matches the `name` field in servicesArray) |

**Sample Request:**

```bash
curl --location 'http://localhost:3000/services/git/PersonalWeb03%20API' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "gitBranchesArray": [
    "main",
    "dev",
    "dev_07",
    "feature/new-ui"
  ],
  "currentBranch": "dev_07"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `gitBranchesArray` | String[] | Array of remote branch names (without "origin/" prefix) |
| `currentBranch` | String | The currently checked out branch name |

**Error Response (400 Bad Request - Not Production):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "This endpoint only works in production or testing environment on Ubuntu OS",
    "status": 400
  }
}
```

**Error Response (404 Not Found - Service Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service not found",
    "details": "Service with name \"PersonalWeb03 API\" is not configured in this machine's servicesArray",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to get remote branches",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates that `name` exists in machine's servicesArray
- Constructs project path as `/home/nick/applications/{name}`
- Executes `git branch -r` in the project directory to get remote branches
- Filters out HEAD pointers and removes "origin/" prefix from branch names
- Executes `git branch --show-current` to get the currently checked out branch
- Returns array of remote branch names and current branch name
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers

**Notes:**

- The `name` parameter must match the `name` field in servicesArray
- URL encode the service name if it contains spaces
- Returns remote branches only (not local branches)

---

## POST /services/git/:name/:action

Execute git fetch or pull for a service's repository.

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | String | Yes | Service name (matches the `name` field in servicesArray) |
| `action` | String | Yes | Git action to perform: `fetch` or `pull` |

**Sample Request (Fetch):**

```bash
curl --location --request POST 'http://localhost:3000/services/git/PersonalWeb03%20API/fetch' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Sample Request (Pull):**

```bash
curl --location --request POST 'http://localhost:3000/services/git/PersonalWeb03%20API/pull' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "action": "fetch",
  "stdout": "From https://github.com/user/repo\n   abc1234..def5678  main       -> origin/main",
  "stderr": ""
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Whether the git command succeeded |
| `action` | String | The action that was executed ("fetch" or "pull") |
| `stdout` | String | Standard output from the git command |
| `stderr` | String | Standard error from the git command |

**Error Response (400 Bad Request - Invalid Action):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid action",
    "details": "Invalid action. Must be one of: fetch, pull",
    "status": 400
  }
}
```

**Error Response (404 Not Found - Service Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service not found",
    "details": "Service with name \"PersonalWeb03 API\" is not configured in this machine's servicesArray",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to execute git fetch",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates that `name` exists in machine's servicesArray
- Validates that `action` is either "fetch" or "pull"
- Constructs project path as `/home/nick/applications/{name}`
- Executes `git fetch` or `git pull` in the project directory
- Returns command output in response
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers

**Notes:**

- The `name` parameter must match the `name` field in servicesArray
- URL encode the service name if it contains spaces
- `fetch` updates remote tracking branches without merging
- `pull` fetches and merges changes into the current branch

---

## POST /services/git/checkout/:name/:branchName

Checkout a specific branch in a service's repository.

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | String | Yes | Service name (matches the `name` field in servicesArray) |
| `branchName` | String | Yes | Name of the branch to checkout |

**Sample Request:**

```bash
curl --location --request POST 'http://localhost:3000/services/git/checkout/PersonalWeb03%20API/dev_07' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "branchName": "dev_07",
  "stdout": "Switched to branch 'dev_07'\nYour branch is up to date with 'origin/dev_07'.",
  "stderr": ""
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Whether the checkout succeeded |
| `branchName` | String | The branch that was checked out |
| `stdout` | String | Standard output from the git command |
| `stderr` | String | Standard error from the git command |

**Error Response (404 Not Found - Service Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service not found",
    "details": "Service with name \"PersonalWeb03 API\" is not configured in this machine's servicesArray",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to checkout branch \"dev_07\"",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates that `name` exists in machine's servicesArray
- Constructs project path as `/home/nick/applications/{name}`
- Executes `git checkout {branchName}` in the project directory
- Returns command output in response
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers

**Notes:**

- The `name` parameter must match the `name` field in servicesArray
- URL encode the service name if it contains spaces
- The branch must exist (either locally or as a remote tracking branch)
- May fail if there are uncommitted changes in the working directory

---

## DELETE /services/git/delete-branch/:name/:branchName

Delete a local branch from a service's repository using `git branch -D` (force delete).

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | String | Yes | Service name (matches the `name` field in servicesArray) |
| `branchName` | String | Yes | Name of the branch to delete |

**Sample Request:**

```bash
curl --location --request DELETE 'http://localhost:3000/services/git/delete-branch/PersonalWeb03%20API/old-feature' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "branchName": "old-feature",
  "stdout": "Deleted branch old-feature (was abc1234).",
  "stderr": ""
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Whether the branch deletion succeeded |
| `branchName` | String | The branch that was deleted |
| `stdout` | String | Standard output from the git command |
| `stderr` | String | Standard error from the git command |

**Error Response (404 Not Found - Service Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service not found",
    "details": "Service with name \"PersonalWeb03 API\" is not configured in this machine's servicesArray",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete branch \"old-feature\"",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates that `name` exists in machine's servicesArray
- Constructs project path as `/home/nick/applications/{name}`
- Executes `git branch -D {branchName}` in the project directory (force delete)
- Returns command output in response
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers

**Notes:**

- The `name` parameter must match the `name` field in servicesArray
- URL encode the service name if it contains spaces
- Uses `-D` flag (force delete) to delete branches regardless of merge status
- Cannot delete the currently checked out branch
- Will fail if the branch doesn't exist locally
- This permanently deletes the local branch (does not affect remote branches)

---
