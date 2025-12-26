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
      "status": "active (running) since Thu 2025-12-25 10:30:00 UTC; 2h ago"
    },
    {
      "name": "PersonalWeb03 Services",
      "filename": "personalweb03-services.service",
      "status": "inactive (dead) since Thu 2025-12-25 19:19:14 UTC; 5min ago",
      "timerStatus": "active (waiting) since Thu 2025-12-25 19:19:04 UTC; 4min 40s ago",
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
| `servicesStatusArray[].status` | String | Active status from systemctl (e.g., "active (running)", "inactive (dead)", "failed") |
| `servicesStatusArray[].timerStatus` | String | Active status of timer (optional, only if filenameTimer configured) |
| `servicesStatusArray[].timerTrigger` | String | Next trigger time (optional, only if filenameTimer configured) |

**Error Response (400 Bad Request - Not Production):**

```json
{
  "error": "This endpoint only works in production environment on Ubuntu OS"
}
```

**Error Response (404 Not Found - Machine Not Found):**

```json
{
  "error": "Machine with name \"ubuntu-server-01\" not found in database"
}
```

**Error Response (404 Not Found - No Services):**

```json
{
  "error": "Machine \"ubuntu-server-01\" has no services configured in servicesArray"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": "Failed to fetch services status",
  "details": "Error details here"
}
```

**Behavior:**

- Retrieves machine's servicesArray using OS hostname from `getMachineInfo()`
- Executes `sudo systemctl status {filename}` for each service
- If service has `filenameTimer`, also executes `sudo systemctl status {filenameTimer}`
- Parses systemctl output to extract "Active:" and "Trigger:" fields
- Services with errors return `status: "unknown"` but don't fail entire request
- Only works when `NODE_ENV=production` on Ubuntu servers with systemd

---

## POST /services/:serviceFilename/:toggleStatus

Control a service by starting, stopping, restarting, or performing other systemctl actions.

**Authentication:** Required (JWT token)

**Environment:** Production only (Ubuntu OS with systemd)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serviceFilename` | String | Yes | Service filename (e.g., "personalweb03-api.service") |
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
  "status": "active (running) since Thu 2025-12-26 14:22:00 UTC; 2s ago"
}
```

**Success Response with Timer (200 OK):**

```json
{
  "name": "PersonalWeb03 Services",
  "filename": "personalweb03-services.service",
  "status": "inactive (dead) since Thu 2025-12-25 19:19:14 UTC; 5min ago",
  "timerStatus": "active (waiting) since Thu 2025-12-25 19:19:04 UTC; 4min 40s ago",
  "timerTrigger": "Thu 2025-12-25 23:00:00 UTC; 3h 36min left"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Human-readable service name from servicesArray |
| `filename` | String | Systemd service filename |
| `status` | String | Active status after toggle operation |
| `timerStatus` | String | Active status of timer (optional, only if filenameTimer configured) |
| `timerTrigger` | String | Next trigger time (optional, only if filenameTimer configured) |

**Error Response (400 Bad Request - Not Production):**

```json
{
  "error": "This endpoint only works in production environment on Ubuntu OS"
}
```

**Error Response (400 Bad Request - Invalid Action):**

```json
{
  "error": "Invalid toggleStatus. Must be one of: start, stop, restart, reload, enable, disable"
}
```

**Error Response (404 Not Found - Machine Not Found):**

```json
{
  "error": "Machine with name \"ubuntu-server-01\" not found in database"
}
```

**Error Response (404 Not Found - No Services):**

```json
{
  "error": "Machine \"ubuntu-server-01\" has no services configured in servicesArray"
}
```

**Error Response (404 Not Found - Service Not Configured):**

```json
{
  "error": "Service with filename \"personalweb03-api.service\" is not configured in this machine's servicesArray"
}
```

**Error Response (500 Internal Server Error - Command Failed):**

```json
{
  "error": "Failed to start service personalweb03-api.service",
  "details": "Command 'sudo systemctl start personalweb03-api.service' failed with exit code 1"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": "Failed to toggle service",
  "details": "Error details here"
}
```

**Behavior:**

- Validates that `serviceFilename` exists in machine's servicesArray before allowing control
- Executes `sudo systemctl {toggleStatus} {serviceFilename}`
- Queries updated service status after toggle operation
- If service has `filenameTimer`, includes timer status/trigger in response
- Only works when `NODE_ENV=production` on Ubuntu servers with systemd
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

---
