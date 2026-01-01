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

| Field                                      | Type     | Description                                                                                                              |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `servicesStatusArray`                      | Object[] | Array of service status objects                                                                                          |
| `servicesStatusArray[].name`               | String   | Human-readable service name from servicesArray                                                                           |
| `servicesStatusArray[].filename`           | String   | Systemd service filename                                                                                                 |
| `servicesStatusArray[].loaded`             | String   | Full "Loaded:" line from systemctl status showing file path and enabled/disabled state                                   |
| `servicesStatusArray[].active`             | String   | Full "Active:" line from systemctl status (e.g., "active (running) since...", "inactive (dead) since...")                |
| `servicesStatusArray[].status`             | String   | Simplified status: "active", "inactive", "failed", "activating", "deactivating", or "unknown"                            |
| `servicesStatusArray[].onStartStatus`      | String   | Whether service starts on boot: "enabled", "disabled", "static", or "unknown" (parsed from loaded line)                  |
| `servicesStatusArray[].timerLoaded`        | String   | Full "Loaded:" line from timer's systemctl status (optional, only if filenameTimer configured)                           |
| `servicesStatusArray[].timerActive`        | String   | Full "Active:" line from timer's systemctl status (optional, only if filenameTimer configured)                           |
| `servicesStatusArray[].timerStatus`        | String   | Simplified timer status: "active", "inactive", or "unknown" (optional, only if filenameTimer configured)                 |
| `servicesStatusArray[].timerOnStartStatus` | String   | Whether timer starts on boot: "enabled", "disabled", "static", or "unknown" (optional, only if filenameTimer configured) |
| `servicesStatusArray[].timerTrigger`       | String   | Next trigger time (optional, only if filenameTimer configured)                                                           |

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

## POST /services/control/:serviceFilename/:toggleStatus

Control a service by starting, stopping, restarting, or performing other systemctl actions.

**Authentication:** Required (JWT token)

**Environment:** Production only (Ubuntu OS with systemd)

**URL Parameters:**

| Parameter         | Type   | Required | Description                                                                                     |
| ----------------- | ------ | -------- | ----------------------------------------------------------------------------------------------- |
| `serviceFilename` | String | Yes      | Service or timer filename (e.g., "personalweb03-api.service" or "personalweb03-services.timer") |
| `toggleStatus`    | String | Yes      | Action to perform: start, stop, restart, reload, enable, disable                                |

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

| Field                | Type   | Description                                                                                                              |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `name`               | String | Human-readable service name from servicesArray                                                                           |
| `filename`           | String | Systemd service filename                                                                                                 |
| `loaded`             | String | Full "Loaded:" line from systemctl status showing file path and enabled/disabled state                                   |
| `active`             | String | Full "Active:" line from systemctl status after toggle operation                                                         |
| `status`             | String | Simplified status: "active", "inactive", "failed", etc.                                                                  |
| `onStartStatus`      | String | Whether service starts on boot: "enabled", "disabled", "static", or "unknown"                                            |
| `timerLoaded`        | String | Full "Loaded:" line from timer's systemctl status (optional, only if filenameTimer configured)                           |
| `timerActive`        | String | Full "Active:" line from timer's systemctl status (optional, only if filenameTimer configured)                           |
| `timerStatus`        | String | Simplified timer status: "active", "inactive", or "unknown" (optional, only if filenameTimer configured)                 |
| `timerOnStartStatus` | String | Whether timer starts on boot: "enabled", "disabled", "static", or "unknown" (optional, only if filenameTimer configured) |
| `timerTrigger`       | String | Next trigger time (optional, only if filenameTimer configured)                                                           |

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

| Parameter | Type   | Required | Description                                              |
| --------- | ------ | -------- | -------------------------------------------------------- |
| `name`    | String | Yes      | Service name (matches the `name` field in servicesArray) |

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

Get the list of local branches, remote branches, and current branch for a service's git repository.

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter | Type   | Required | Description                                              |
| --------- | ------ | -------- | -------------------------------------------------------- |
| `name`    | String | Yes      | Service name (matches the `name` field in servicesArray) |

**Sample Request:**

```bash
curl --location 'http://localhost:3000/services/git/PersonalWeb03%20API' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "gitBranchesLocalArray": ["main", "dev", "dev_07", "feature/new-ui"],
  "gitBranchesRemoteArray": ["main", "dev", "production"],
  "currentBranch": "dev_07"
}
```

**Response Fields:**

| Field                    | Type     | Description                                                  |
| ------------------------ | -------- | ------------------------------------------------------------ |
| `gitBranchesLocalArray`  | String[] | Array of local branch names                                  |
| `gitBranchesRemoteArray` | String[] | Array of remote branch names (with "origin/" prefix removed) |
| `currentBranch`          | String   | The currently checked out branch name                        |

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
- Executes `git branch` in the project directory to get local branches
- Removes asterisk (\*) from currently checked out branch in the list
- Executes `git branch --show-current` to get the currently checked out branch
- Executes `git branch -r` to get remote branches (filters out HEAD pointer, removes "origin/" prefix)
- Returns arrays of local and remote branch names along with current branch name
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers

**Notes:**

- The `name` parameter must match the `name` field in servicesArray
- URL encode the service name if it contains spaces
- Returns both local branches (branches in the local repository) and remote branches (from origin)
- Remote branch names have the "origin/" prefix removed for cleaner display
- Reflects branch changes immediately when branches are created, deleted, or pushed locally/remotely

---

## POST /services/git/:name/:action

Execute git fetch or pull for a service's repository.

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter | Type   | Required | Description                                              |
| --------- | ------ | -------- | -------------------------------------------------------- |
| `name`    | String | Yes      | Service name (matches the `name` field in servicesArray) |
| `action`  | String | Yes      | Git action to perform: `fetch` or `pull`                 |

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

| Field     | Type    | Description                                      |
| --------- | ------- | ------------------------------------------------ |
| `success` | Boolean | Whether the git command succeeded                |
| `action`  | String  | The action that was executed ("fetch" or "pull") |
| `stdout`  | String  | Standard output from the git command             |
| `stderr`  | String  | Standard error from the git command              |

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

| Parameter    | Type   | Required | Description                                              |
| ------------ | ------ | -------- | -------------------------------------------------------- |
| `name`       | String | Yes      | Service name (matches the `name` field in servicesArray) |
| `branchName` | String | Yes      | Name of the branch to checkout                           |

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

| Field        | Type    | Description                          |
| ------------ | ------- | ------------------------------------ |
| `success`    | Boolean | Whether the checkout succeeded       |
| `branchName` | String  | The branch that was checked out      |
| `stdout`     | String  | Standard output from the git command |
| `stderr`     | String  | Standard error from the git command  |

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

| Parameter    | Type   | Required | Description                                              |
| ------------ | ------ | -------- | -------------------------------------------------------- |
| `name`       | String | Yes      | Service name (matches the `name` field in servicesArray) |
| `branchName` | String | Yes      | Name of the branch to delete                             |

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

| Field        | Type    | Description                           |
| ------------ | ------- | ------------------------------------- |
| `success`    | Boolean | Whether the branch deletion succeeded |
| `branchName` | String  | The branch that was deleted           |
| `stdout`     | String  | Standard output from the git command  |
| `stderr`     | String  | Standard error from the git command   |

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

## POST /services/npm/:name/:action

Execute npm install or npm build for a service's project.

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter | Type   | Required | Description                                              |
| --------- | ------ | -------- | -------------------------------------------------------- |
| `name`    | String | Yes      | Service name (matches the `name` field in servicesArray) |
| `action`  | String | Yes      | npm action to perform: `install` or `build`              |

**Sample Request (npm install):**

```bash
curl --location --request POST 'http://localhost:3000/services/npm/PersonalWeb03%20API/install' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Sample Request (npm build):**

```bash
curl --location --request POST 'http://localhost:3000/services/npm/PersonalWeb03%20API/build' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "warnings": "no warnings",
  "failureReason": null
}
```

**Success Response with Warnings (200 OK):**

```json
{
  "status": "success",
  "warnings": "npm WARN deprecated package@1.0.0: This package is deprecated\nnpm WARN peer dependency warning",
  "failureReason": null
}
```

**Failure Response (200 OK):**

```json
{
  "status": "fail",
  "warnings": "npm WARN some warning",
  "failureReason": "npm ERR! Missing script: \"build\"\nnpm ERR! To see a list of scripts, run:\nnpm ERR!   npm run"
}
```

**Response Fields:**

| Field           | Type           | Description                                                      |
| --------------- | -------------- | ---------------------------------------------------------------- |
| `status`        | String         | Status of the npm command: "success" or "fail"                   |
| `warnings`      | String         | Warning messages from npm output, or "no warnings" if none found |
| `failureReason` | String \| null | Reason for failure if status is "fail", otherwise null           |

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

**Error Response (400 Bad Request - Invalid Action):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid action",
    "details": "Invalid action. Must be one of: install, build",
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
    "message": "Failed to execute npm command",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates that `name` exists in machine's servicesArray
- Validates that `action` is either "install" or "build"
- Constructs project path as `/home/nick/applications/{name}`
- Executes `npm install` or `npm run build` in the project directory
- Parses stdout and stderr to extract warnings (lines containing "warn", "warning", or "deprecated")
- Parses error output to extract failure reason on failure
- Returns status, warnings, and failureReason regardless of success or failure
- Uses 10MB buffer to handle large npm output
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers

**Notes:**

- The `name` parameter must match the `name` field in servicesArray
- URL encode the service name if it contains spaces
- Response has 200 status code even on npm failure (check `status` field in response body)
- `install` action runs `npm install` to install dependencies
- `build` action runs `npm run build` and requires a "build" script in package.json
- Warnings are extracted from both successful and failed npm operations
- Large build outputs are supported (up to 10MB)

---

## POST /services/make-service-file

Generate systemd service and timer files from templates with variable substitution.

**Authentication:** Required (JWT token)

**Request Body:**

| Field                       | Type   | Required | Description                                                                                                                                 |
| --------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `filenameServiceTemplate`   | String | Yes      | Service template filename: expressjs.service, flask.service, fastapi.service, nextjs.service, nodejsscript.service, or pythonscript.service |
| `filenameTimerTemplate`     | String | No       | Timer template filename: nodejsscript.timer or pythonscript.timer                                                                           |
| `variables`                 | Object | Yes      | Object containing template variables                                                                                                        |
| `variables.project_name`    | String | Yes      | Project name (used as-is for PROJECT_NAME placeholder, auto-converted to lowercase for filenames)                                           |
| `variables.python_env_name` | String | No       | Python virtual environment name (required for Python templates)                                                                             |
| `variables.port`            | Number | No       | Port number the application will run on (required for most templates)                                                                       |

**Sample Request (Express.js service only):**

```bash
curl --location --request POST 'http://localhost:3000/services/make-service-file' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "filenameServiceTemplate": "expressjs.service",
  "variables": {
    "project_name": "MyProject-API",
    "port": 3000
  }
}'
```

**Sample Request (Python service with timer):**

```bash
curl --location --request POST 'http://localhost:3000/services/make-service-file' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "filenameServiceTemplate": "pythonscript.service",
  "filenameTimerTemplate": "pythonscript.timer",
  "variables": {
    "project_name": "DataProcessor",
    "python_env_name": "dataprocessor_env",
    "port": 5000
  }
}'
```

**Success Response (201 Created - Service Only):**

```json
{
  "message": "Service file(s) created successfully",
  "service": {
    "template": "expressjs.service",
    "outputPath": "/path/to/service/files/myproject-api.service",
    "filename": "myproject-api.service",
    "content": "[Unit]\nDescription=MyProject-API ExpressJS API Application\nAfter=network.target\n..."
  },
  "variablesApplied": {
    "project_name": "MyProject-API",
    "project_name_lowercase": "myproject-api",
    "port": 3000
  }
}
```

**Success Response (201 Created - Service with Timer):**

```json
{
  "message": "Service file(s) created successfully",
  "service": {
    "template": "pythonscript.service",
    "outputPath": "/path/to/service/files/dataprocessor.service",
    "filename": "dataprocessor.service",
    "content": "[Unit]\nDescription=DataProcessor Python Script\n..."
  },
  "timer": {
    "template": "pythonscript.timer",
    "outputPath": "/path/to/service/files/dataprocessor.timer",
    "filename": "dataprocessor.timer",
    "content": "[Unit]\nDescription=DataProcessor Python Script Timer\nRequires=dataprocessor.service\n..."
  },
  "variablesApplied": {
    "project_name": "DataProcessor",
    "project_name_lowercase": "dataprocessor",
    "python_env_name": "dataprocessor_env",
    "port": 5000
  }
}
```

**Response Fields:**

| Field                                     | Type   | Description                                                                   |
| ----------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `message`                                 | String | Success message                                                               |
| `service`                                 | Object | Service file information                                                      |
| `service.template`                        | String | Template filename that was used                                               |
| `service.outputPath`                      | String | Full path where the service file was written                                  |
| `service.filename`                        | String | Generated service filename (project_name_lowercase.service)                   |
| `service.content`                         | String | Complete content of the generated service file                                |
| `timer`                                   | Object | Timer file information (optional, only if filenameTimerTemplate was provided) |
| `timer.template`                          | String | Timer template filename that was used                                         |
| `timer.outputPath`                        | String | Full path where the timer file was written                                    |
| `timer.filename`                          | String | Generated timer filename (project_name_lowercase.timer)                       |
| `timer.content`                           | String | Complete content of the generated timer file                                  |
| `variablesApplied`                        | Object | All variables that were applied to the templates                              |
| `variablesApplied.project_name`           | String | Original project name as provided                                             |
| `variablesApplied.project_name_lowercase` | String | Auto-generated lowercase version used for filenames                           |
| `variablesApplied.python_env_name`        | String | Python environment name (if provided)                                         |
| `variablesApplied.port`                   | Number | Port number (if provided)                                                     |

**Error Response (400 Bad Request - Missing Required Field):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing required field: filenameServiceTemplate",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Invalid Template):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid service template",
    "details": "filenameServiceTemplate must be one of: expressjs.service, flask.service, nodejsscript.service, pythonscript.service, fastapi.service, nextjs.service",
    "status": 400
  }
}
```

**Error Response (500 Internal Server Error - Missing PATH_TO_SERVICE_FILES):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Server configuration error",
    "details": "PATH_TO_SERVICE_FILES environment variable is not set",
    "status": 500
  }
}
```

**Behavior:**

- Validates `filenameServiceTemplate` against list of valid service templates
- Validates `filenameTimerTemplate` (if provided) against list of valid timer templates
- Requires `variables.project_name` field
- Auto-generates `project_name_lowercase` by converting `project_name` to lowercase
- Reads template files from `src/templates/systemdServiceFiles/`
- Replaces template placeholders:
  - `{{PROJECT_NAME}}` → `variables.project_name`
  - `{{PROJECT_NAME_LOWERCASE}}` → Auto-generated lowercase version
  - `{{PYTHON_ENV_NAME}}` → `variables.python_env_name`
  - `{{PORT}}` → `variables.port`
- Writes files to directory specified in `PATH_TO_SERVICE_FILES` environment variable
- Overwrites existing files with the same name without warning
- Returns both file paths and complete file contents in response

**Template Requirements:**

**Express.js / Next.js / Node.js Script:**

- Required variables: `project_name`, `port`
- Generated paths: `/home/nick/applications/{{PROJECT_NAME}}`

**FastAPI / Flask / Python Script:**

- Required variables: `project_name`, `python_env_name`, `port`
- Generated paths: `/home/nick/applications/{{PROJECT_NAME}}`, `/home/nick/environments/{{PYTHON_ENV_NAME}}`

**Timers (nodejsscript.timer / pythonscript.timer):**

- Required variables: `project_name`
- Auto-generates: `project_name_lowercase` for `Requires={{PROJECT_NAME_LOWERCASE}}.service` directive

**Notes:**

- Generated filenames are always lowercase: `{project_name_lowercase}.service` and `{project_name_lowercase}.timer`
- Example: `project_name: "MyProject-API"` generates `myproject-api.service`
- Existing files are overwritten without confirmation
- The `timer` field in response is only included if `filenameTimerTemplate` was provided
- Port variable is not required for timer templates
- Python templates require `python_env_name` to specify the virtual environment path
- Template files use `{{PLACEHOLDER}}` syntax (double curly braces)
- All generated files follow systemd unit file format
- Files are automatically written to `/etc/systemd/system/` using sudo mv (production) or `PATH_TO_SERVICE_FILES` (testing)

---

## GET /services/service-file/:filename

Read the contents of a service and/or timer file. Accepts either a `.service` or `.timer` filename and returns both file types if they exist.

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter  | Type   | Required | Description                                                        |
| ---------- | ------ | -------- | ------------------------------------------------------------------ |
| `filename` | String | Yes      | Service or timer filename (e.g., "myapp.service" or "myapp.timer") |

**Sample Request:**

```bash
curl --location 'http://localhost:3000/services/service-file/myapp.service' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK - Both Files Found):**

```json
{
  "status": "success",
  "filenameService": "myapp.service",
  "filenameTimer": "myapp.timer",
  "fileContentService": "[Unit]\nDescription=MyApp Service\nAfter=network.target\n\n[Service]\nType=simple\nUser=nick\nWorkingDirectory=/home/nick/applications/MyApp\nExecStart=/usr/bin/node /home/nick/applications/MyApp/dist/server.js\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target",
  "fileContentTimer": "[Unit]\nDescription=MyApp Timer\nRequires=myapp.service\n\n[Timer]\nOnCalendar=daily\nPersistent=true\n\n[Install]\nWantedBy=timers.target"
}
```

**Success Response (200 OK - Only Service File Found):**

```json
{
  "status": "success",
  "filenameService": "myapp.service",
  "filenameTimer": "myapp.timer",
  "fileContentService": "[Unit]\nDescription=MyApp Service\n...",
  "fileContentTimer": null
}
```

**Response Fields:**

| Field                | Type           | Description                                        |
| -------------------- | -------------- | -------------------------------------------------- |
| `status`             | String         | Status of the operation ("success")                |
| `filenameService`    | String         | Service filename that was searched for             |
| `filenameTimer`      | String         | Timer filename that was searched for               |
| `fileContentService` | String \| null | Content of the .service file, or null if not found |
| `fileContentTimer`   | String \| null | Content of the .timer file, or null if not found   |

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

**Error Response (400 Bad Request - Invalid Filename Format):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid filename format",
    "details": "Filename must include extension (e.g., app.service or app.timer)",
    "status": 400
  }
}
```

**Error Response (404 Not Found - No Files Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service files not found",
    "details": "Neither myapp.service nor myapp.timer found in /etc/systemd/system/",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error - Missing PATH_TO_SERVICE_FILES):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Server configuration error",
    "details": "PATH_TO_SERVICE_FILES environment variable is not set",
    "status": 500
  }
}
```

**Behavior:**

- Parses filename to extract base name (splits on period)
- Searches for both `{basename}.service` and `{basename}.timer` files
- Uses `sudo cat` to read files from `PATH_TO_SERVICE_FILES` directory
- Returns success if at least one file is found
- Sets `null` for files that don't exist
- Both files share the same base name (e.g., "myapp.service" and "myapp.timer" both use base name "myapp")
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers

**Notes:**

- You can request either `.service` or `.timer` - both file types will be returned if they exist
- Example: `GET /services/service-file/myapp.service` returns both myapp.service and myapp.timer
- Example: `GET /services/service-file/myapp.timer` also returns both files
- If only one file exists, the other will be `null` in the response
- Files are read using sudo permissions from the PATH_TO_SERVICE_FILES directory
- Use this endpoint before editing to get current file contents

---

## POST /services/service-file/:filename

Update an existing service or timer file. Validates that the file exists and is configured for the current machine before allowing updates.

**Authentication:** Required (JWT token)

**Environment:** Production/Testing only (Ubuntu OS)

**URL Parameters:**

| Parameter  | Type   | Required | Description                                                                  |
| ---------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `filename` | String | Yes      | Service or timer filename to update (e.g., "myapp.service" or "myapp.timer") |

**Request Body:**

| Field          | Type   | Required | Description                                   |
| -------------- | ------ | -------- | --------------------------------------------- |
| `fileContents` | String | Yes      | Complete content of the service or timer file |

**Sample Request:**

```bash
curl --location --request POST 'http://localhost:3000/services/service-file/myapp.service' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "fileContents": "[Unit]\nDescription=MyApp Service Updated\nAfter=network.target\n\n[Service]\nType=simple\nUser=nick\nWorkingDirectory=/home/nick/applications/MyApp\nExecStart=/usr/bin/node /home/nick/applications/MyApp/dist/server.js\nRestart=always\n\n[Install]\nWantedBy=multi-user.target"
}'
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "message": "Service file updated successfully",
  "filename": "myapp.service"
}
```

**Response Fields:**

| Field      | Type   | Description                         |
| ---------- | ------ | ----------------------------------- |
| `status`   | String | Status of the operation ("success") |
| `message`  | String | Success message                     |
| `filename` | String | Filename that was updated           |

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

**Error Response (400 Bad Request - Missing fileContents):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing or invalid 'fileContents' in request body",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - File Not Configured):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Service file not configured for this machine",
    "details": "File \"myapp.service\" is not in this machine's servicesArray",
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

**Error Response (404 Not Found - File Doesn't Exist):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service file not found",
    "details": "File \"myapp.service\" does not exist in /etc/systemd/system/",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error - Missing PATH_TO_SERVICE_FILES):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Server configuration error",
    "details": "PATH_TO_SERVICE_FILES environment variable is not set",
    "status": 500
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to update service file",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates that `filename` exists in current machine's `servicesArray` (checks both `filename` and `filenameTimer` fields)
- Uses `getMachineInfo()` to identify current machine by hostname
- Checks that file exists in `PATH_TO_SERVICE_FILES` before allowing update
- Writes new content to `/home/nick/{filename}` first (no sudo needed)
- Uses `sudo mv "/home/nick/{filename}" "{PATH_TO_SERVICE_FILES}/"` to move file to system directory
- Returns error if file doesn't exist (use POST `/services/make-service-file` to create new files)
- Only works when `NODE_ENV=production` or `NODE_ENV=testing` on Ubuntu servers

**Notes:**

- This endpoint is for updating existing files only - it will not create new files
- To create new service/timer files, use POST `/services/make-service-file`
- The filename must be configured in the machine's `servicesArray` in MongoDB
- File existence is checked before attempting update to prevent creating unauthorized files
- After updating, you may need to reload systemd: `systemctl daemon-reload`
- Then restart the service: `systemctl restart {servicename}`
- Use GET `/services/service-file/:filename` first to retrieve current contents before editing

---
