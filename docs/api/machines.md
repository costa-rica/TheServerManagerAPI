# Machine Routes

Machine management endpoints for registering, updating, and managing server instances in the network.

---

## GET /machines/name

Get the current machine's hostname and local IP address from the OS.

**Authentication:** Required (JWT token)

**Sample Request:**

```bash
curl --location 'http://localhost:3000/machines/name' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "machineName": "ubuntu-server-01",
  "localIpAddress": "192.168.1.100"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": "Failed to retrieve machine information"
}
```

---

## GET /machines/check-nick-systemctl

Build a services array by scanning `/home/nick/nick-systemctl.csv` and validating service files. This endpoint is designed to help populate the services form in TheServerManagerNextJS web application.

**Authentication:** Required (JWT token)

**Process:**

1. Reads `/home/nick/nick-systemctl.csv` and extracts unique unit filenames from the `unit` column
2. Builds a service map linking `.timer` files to their corresponding `.service` files
3. Validates that all service files exist in `/etc/systemd/system/`
4. Extracts port numbers from each service file (looks for `PORT=` or `0.0.0.0:` followed by exactly 4 digits)
5. Returns array of service objects with `filename`, optional `port`, and optional `filenameTimer`

**CSV File Format:**

The endpoint expects `/home/nick/nick-systemctl.csv` with the following structure:

```csv
user,runas,tag,command,action,unit
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,restart,tsm-api.service
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,restart,tsm-api.timer
```

**Sample Request:**

```bash
curl --location 'http://localhost:3000/machines/check-nick-systemctl' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "message": "Services array built successfully from nick-systemctl.csv",
  "servicesArray": [
    {
      "filename": "tsm-api.service",
      "port": 3000,
      "filenameTimer": "tsm-api.timer"
    },
    {
      "filename": "another-app.service",
      "port": 8080
    },
    {
      "filename": "no-port-app.service"
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `servicesArray[].filename` | String | Service filename from CSV (always ends with `.service`) |
| `servicesArray[].port` | Number | Port number extracted from service file (optional, only if found) |
| `servicesArray[].filenameTimer` | String | Associated timer filename (optional, only if `.timer` file exists in CSV) |

**Error Response (404 Not Found - CSV File Missing):**

```json
{
  "error": {
    "code": "CSV_FILE_NOT_FOUND",
    "message": "CSV file not found",
    "details": "The file /home/nick/nick-systemctl.csv does not exist on this server",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error - CSV Read Error):**

```json
{
  "error": {
    "code": "CSV_FILE_READ_ERROR",
    "message": "Failed to read CSV file",
    "details": "Permission denied",
    "status": 500
  }
}
```

**Error Response (400 Bad Request - Orphaned Timer File):**

```json
{
  "error": {
    "code": "ORPHANED_TIMER_FILE",
    "message": "Orphaned timer file found",
    "details": "Timer file 'my-app.timer' found in CSV but corresponding service file 'my-app.service' is not present in the CSV",
    "status": 400
  }
}
```

**Error Response (404 Not Found - Service File Missing):**

```json
{
  "error": {
    "code": "SERVICE_FILE_NOT_FOUND_IN_DIRECTORY",
    "message": "Service file not found in systemd directory",
    "details": "Service file 'tsm-api.service' is listed in the CSV but does not exist at /etc/systemd/system/tsm-api.service",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error - Service File Read Error):**

```json
{
  "error": {
    "code": "SERVICE_FILE_READ_ERROR",
    "message": "Failed to read service file",
    "details": "Permission denied",
    "status": 500
  }
}
```

**Error Response (400 Bad Request - Invalid Port Format):**

```json
{
  "error": {
    "code": "INVALID_PORT_FORMAT",
    "message": "Invalid port number format",
    "details": "Service file 'tsm-api.service' contains port number '80' which is not exactly 4 digits",
    "status": 400
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to build services array",
    "details": "Unexpected error occurred",
    "status": 500
  }
}
```

**Behavior:**

- Only processes `.service` and `.timer` files from CSV
- `.timer` files must have a corresponding `.service` file with the same base name
- Port extraction looks for exactly 4-digit numbers after `PORT=` or `0.0.0.0:`
- Returns first matching port pattern found in service file
- Port and timer fields are optional in response (only included if found)
- All errors follow standardized error response format
- `details` field in errors is only populated in development (NODE_ENV !== 'production')

---

## GET /machines

Get all registered machines in the system.

**Authentication:** Required (JWT token)

**Sample Request:**

```bash
curl --location 'http://localhost:3000/machines' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "result": true,
  "existingMachines": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "publicId": "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
      "machineName": "ubuntu-server-01",
      "urlFor404Api": "http://192.168.1.100:8000",
      "localIpAddress": "192.168.1.100",
      "nginxStoragePathOptions": ["/var/www", "/home/user/sites"],
      "servicesArray": [
        {
          "name": "PersonalWeb03 API",
          "filename": "personalweb03-api.service",
          "pathToLogs": "/home/ubuntu/personalweb03-api/logs",
          "filenameTimer": "personalweb03-api.timer",
          "port": 3001
        }
      ],
      "createdAt": "2025-12-25T10:30:00.000Z",
      "updatedAt": "2025-12-25T10:30:00.000Z"
    }
  ]
}
```

---

## POST /machines

Register a new machine in the system.

**Authentication:** Required (JWT token)

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `urlFor404Api` | String | Yes | URL for the 404 API endpoint |
| `nginxStoragePathOptions` | String[] | Yes | Array of nginx storage paths |
| `servicesArray` | Object[] | No | Array of systemd service configurations |
| `servicesArray[].filename` | String | Yes* | Systemd service filename (e.g., "app.service") |
| `servicesArray[].pathToLogs` | String | Yes* | Path to service log directory |
| `servicesArray[].filenameTimer` | String | No | Systemd timer filename if applicable |
| `servicesArray[].port` | Number | No | Port number the service runs on |

*Required if `servicesArray` is provided

**Auto-Populated Fields (per service):**

| Field | Source | Description |
|-------|--------|-------------|
| `servicesArray[].name` | NAME_APP from .env | Extracted from NAME_APP variable in .env file located in WorkingDirectory |
| `servicesArray[].workingDirectory` | Service file | Extracted from WorkingDirectory property in /etc/systemd/system/{filename} |

**Sample Request:**

```bash
curl --location 'http://localhost:3000/machines' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "urlFor404Api": "http://192.168.1.100:8000",
  "nginxStoragePathOptions": ["/var/www", "/home/user/sites"],
  "servicesArray": [
    {
      "filename": "personalweb03-api.service",
      "pathToLogs": "/home/ubuntu/personalweb03-api/logs",
      "filenameTimer": "personalweb03-api.timer",
      "port": 3001
    }
  ]
}'
```

**Success Response (201 Created):**

```json
{
  "message": "Machine created successfully",
  "machine": {
    "publicId": "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
    "id": "507f1f77bcf86cd799439011",
    "machineName": "ubuntu-server-01",
    "urlFor404Api": "http://192.168.1.100:8000",
    "localIpAddress": "192.168.1.100",
    "nginxStoragePathOptions": ["/var/www", "/home/user/sites"],
    "servicesArray": [
      {
        "name": "PersonalWeb03 API",
        "filename": "personalweb03-api.service",
        "pathToLogs": "/home/ubuntu/personalweb03-api/logs",
        "workingDirectory": "/home/ubuntu/personalweb03-api",
        "filenameTimer": "personalweb03-api.timer",
        "port": 3001
      }
    ],
    "createdAt": "2025-12-25T10:30:00.000Z",
    "updatedAt": "2025-12-25T10:30:00.000Z"
  }
}
```

**Error Response (400 Bad Request - Missing Fields):**

```json
{
  "error": "Missing urlFor404Api, nginxStoragePathOptions"
}
```

**Error Response (400 Bad Request - Invalid Array):**

```json
{
  "error": "nginxStoragePathOptions must be an array of strings"
}
```

**Error Response (400 Bad Request - Invalid Service):**

```json
{
  "error": "Service at index 0 is missing required fields: filename, pathToLogs"
}
```

**Error Response (400 Bad Request - Service File Not Found):**

```json
{
  "error": {
    "code": "SERVICE_FILE_NOT_FOUND",
    "message": "Service file not found",
    "details": "Service file 'personalweb03-api.service' does not exist at /etc/systemd/system/personalweb03-api.service",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - WorkingDirectory Not Found):**

```json
{
  "error": {
    "code": "WORKING_DIRECTORY_NOT_FOUND",
    "message": "WorkingDirectory not found in service file",
    "details": "Service file 'personalweb03-api.service' is missing the WorkingDirectory property",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - .env File Not Found):**

```json
{
  "error": {
    "code": "ENV_FILE_NOT_FOUND",
    "message": ".env file not found",
    "details": ".env file not found in WorkingDirectory '/home/ubuntu/personalweb03-api' for service 'personalweb03-api.service'",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - NAME_APP Not Found):**

```json
{
  "error": {
    "code": "NAME_APP_NOT_FOUND",
    "message": "NAME_APP not found in .env file",
    "details": "NAME_APP variable not found in .env file for service 'personalweb03-api.service'",
    "status": 400
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": "Failed to create machine"
}
```

**Behavior:**

- Auto-generates `publicId` using crypto.randomUUID()
- Auto-detects `machineName` and `localIpAddress` from OS
- Validates each service object in `servicesArray` if provided:
  - Reads service file from `/etc/systemd/system/{filename}`
  - Extracts `WorkingDirectory` from service file
  - Reads `.env` file from WorkingDirectory
  - Extracts `NAME_APP` from .env to populate service `name`
  - Auto-populates `workingDirectory` field for each service
- Returns empty `servicesArray` if not provided in request
- All service validation happens in all environments (not just production)

---

## PATCH /machines/:publicId

Update an existing machine's configuration (partial update).

**Authentication:** Required (JWT token)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `publicId` | String | Yes | Public ID of the machine to update |

**Request Body Fields (all optional, at least one required):**

| Field | Type | Description |
|-------|------|-------------|
| `urlFor404Api` | String | URL for the 404 API endpoint |
| `nginxStoragePathOptions` | String[] | Array of nginx storage paths |
| `servicesArray` | Object[] | Array of systemd service configurations (see POST for field details) |
| `servicesArray[].filename` | String | Systemd service filename (e.g., "app.service") |
| `servicesArray[].pathToLogs` | String | Path to service log directory |
| `servicesArray[].filenameTimer` | String | Systemd timer filename if applicable (optional) |
| `servicesArray[].port` | Number | Port number the service runs on (optional) |

**Note:** `servicesArray[].name` and `servicesArray[].workingDirectory` are auto-populated from service file validation (same as POST)

**Sample Request:**

```bash
curl --location --request PATCH 'http://localhost:3000/machines/a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "urlFor404Api": "http://192.168.1.100:8080",
  "nginxStoragePathOptions": ["/var/www", "/home/user/sites", "/etc/nginx/sites-available"]
}'
```

**Success Response (200 OK):**

```json
{
  "message": "Machine updated successfully",
  "machine": {
    "publicId": "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
    "id": "507f1f77bcf86cd799439011",
    "machineName": "ubuntu-server-01",
    "urlFor404Api": "http://192.168.1.100:8080",
    "localIpAddress": "192.168.1.100",
    "nginxStoragePathOptions": ["/var/www", "/home/user/sites", "/etc/nginx/sites-available"],
    "servicesArray": [
      {
        "name": "PersonalWeb03 API",
        "filename": "personalweb03-api.service",
        "pathToLogs": "/home/ubuntu/personalweb03-api/logs",
        "workingDirectory": "/home/ubuntu/personalweb03-api",
        "filenameTimer": "personalweb03-api.timer",
        "port": 3001
      }
    ],
    "createdAt": "2025-12-25T10:30:00.000Z",
    "updatedAt": "2025-12-25T14:22:00.000Z"
  }
}
```

**Error Response (400 Bad Request - Invalid publicId):**

```json
{
  "error": "publicId parameter must be a non-empty string"
}
```

**Error Response (400 Bad Request - No Fields):**

```json
{
  "error": "At least one field must be provided for update (urlFor404Api, nginxStoragePathOptions, or servicesArray)"
}
```

**Error Response (404 Not Found):**

```json
{
  "error": "Machine not found"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": "Failed to update machine"
}
```

**Behavior:**

- Supports partial updates (only provided fields are updated)
- Cannot update `publicId`, `machineName`, or `localIpAddress` (auto-generated/detected)
- Validates all provided fields with same rules as POST endpoint
- If `servicesArray` is provided, validates each service:
  - Reads service file from `/etc/systemd/system/{filename}`
  - Auto-populates `name` from NAME_APP in .env
  - Auto-populates `workingDirectory` from service file
  - All service validation errors use standardized error format (see POST)
- Returns complete machine object with updated `updatedAt` timestamp

---

## DELETE /machines/:publicId

Delete a machine from the system.

**Authentication:** Required (JWT token)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `publicId` | String | Yes | Public ID of the machine to delete |

**Sample Request:**

```bash
curl --location --request DELETE 'http://localhost:3000/machines/a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "message": "Machine deleted successfully",
  "deletedMachine": {
    "publicId": "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
    "machineName": "ubuntu-server-01"
  }
}
```

**Error Response (400 Bad Request - Invalid publicId):**

```json
{
  "error": "publicId parameter must be a non-empty string"
}
```

**Error Response (404 Not Found):**

```json
{
  "error": "Machine not found"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": "Failed to delete machine"
}
```
