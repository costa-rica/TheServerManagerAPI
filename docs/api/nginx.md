# Nginx Routes

Nginx configuration management endpoints for creating, scanning, and managing nginx config files.

**Note:** All endpoints require JWT authentication.

---

## GET /nginx

Get all nginx configuration files from the database with populated machine data.

**Authentication:** Required (JWT token)

**Sample Request:**

```bash
curl --location 'http://localhost:3000/nginx' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
[
  {
    "publicId": "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
    "serverName": "api.example.com",
    "portNumber": 3000,
    "serverNameArrayOfAdditionalServerNames": ["www.api.example.com"],
    "appHostServerMachinePublicId": "b4e3c2d1-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "machineNameAppHost": "server-01",
    "localIpAddressAppHost": "192.168.1.100",
    "nginxHostServerMachinePublicId": "c5d4e3f2-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
    "machineNameNginxHost": "nginx-server",
    "localIpAddressNginxHost": "192.168.1.50",
    "framework": "ExpressJs",
    "storeDirectory": "/etc/nginx/sites-available",
    "createdAt": "2025-12-25T10:30:00.000Z",
    "updatedAt": "2025-12-25T10:30:00.000Z"
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `publicId` | String | Unique identifier for the nginx config |
| `serverName` | String | Primary domain name |
| `portNumber` | Number | Application port number |
| `serverNameArrayOfAdditionalServerNames` | String[] | Additional domain names |
| `appHostServerMachinePublicId` | String \| null | Public ID of the machine where app runs |
| `machineNameAppHost` | String \| null | Name of the app host machine (populated from Machine collection) |
| `localIpAddressAppHost` | String \| null | Local IP address of the app host machine (populated) |
| `nginxHostServerMachinePublicId` | String \| null | Public ID of the machine where nginx runs |
| `machineNameNginxHost` | String \| null | Name of the nginx host machine (populated from Machine collection) |
| `localIpAddressNginxHost` | String \| null | Local IP address of the nginx host machine (populated) |
| `framework` | String | Framework type (e.g., "ExpressJs", "Next.js / Python") |
| `storeDirectory` | String | Directory where config file is stored |
| `createdAt` | Date | Record creation timestamp |
| `updatedAt` | Date | Record last update timestamp |

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to fetch nginx files",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Fetches all NginxFile documents from the database
- Automatically populates machine data by looking up referenced machines in the Machine collection
- Uses a single bulk query to fetch all related machines for optimal performance
- Returns `null` for machine fields if the referenced machine is not found
- MongoDB internal fields (`_id`, `__v`) are excluded from the response

---

## GET /nginx/scan-nginx-dir

Scan the nginx directory for configuration files, parse them, and create database entries for new configs.

**Authentication:** Required (JWT token)

**Sample Request:**

```bash
curl --location 'http://localhost:3000/nginx/scan-nginx-dir' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "scanned": 5,
  "new": 3,
  "duplicates": 1,
  "errors": 1,
  "currentMachineIp": "192.168.1.50",
  "nginxHostMachinePublicId": "c5d4e3f2-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
  "reportPath": "/path/to/resources/status_reports/nginxConfigFileScanStatusSummary_2025-12-25T22-45-30-123Z.csv",
  "newEntries": [
    {
      "fileName": "api.example.com",
      "serverName": "api.example.com",
      "additionalServerNames": ["www.api.example.com"],
      "portNumber": 3000,
      "localIpAddress": "192.168.1.100",
      "framework": "ExpressJs",
      "appHostMachineFound": true,
      "publicId": "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c"
    }
  ],
  "duplicateEntries": [
    {
      "fileName": "duplicate.example.com",
      "serverName": "duplicate.example.com",
      "additionalServerNames": [],
      "portNumber": 8080,
      "localIpAddress": "192.168.1.101",
      "framework": "ExpressJs",
      "reason": "Server name already exists in database"
    }
  ],
  "errorEntries": [
    {
      "fileName": "malformed-config",
      "error": "No server names found in config file"
    }
  ]
}
```

**Error Response (404 Not Found - Machine Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Current machine not found in database",
    "details": "Current IP: 192.168.1.50 (only in development mode)",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error - Directory Read Failed):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to read nginx directory",
    "details": "/etc/nginx/sites-available: ENOENT: no such file or directory (only in development mode)",
    "status": 500
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to scan nginx directory",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Reads from directory specified in `PATH_ETC_NGINX_SITES_AVAILABLE` environment variable
- Automatically filters out 'default' config file
- Parses each config file using `parseNginxConfig()` to extract server names, ports, IP addresses, and framework
- Creates database entries only for new configurations (skips duplicates based on primary server name)
- Attempts to match local IP addresses to machines in database for `appHostServerMachinePublicId`
- Generates CSV report saved to `PATH_PROJECT_RESOURCES/status_reports/`
- Auto-generates `publicId` for new entries using crypto.randomUUID()

---

## POST /nginx/create-config-file

Create a new nginx configuration file from a template and save it to the specified directory.

**Authentication:** Required (JWT token)

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `templateFileName` | String | Yes | Template type: "expressJs" or "nextJsPython" |
| `serverNamesArray` | String[] | Yes | Array of domain names (first is primary) |
| `appHostServerMachinePublicId` | String | Yes | Public ID of machine where app runs |
| `portNumber` | Number | Yes | Port number (1-65535) |
| `saveDestination` | String | Yes | Directory path to save config file |

**Available Templates:**

- `"expressJs"` → Uses `expressJsSitesAvailable.txt` template
- `"nextJsPython"` → Uses `nextJsPythonSitesAvailable.txt` template

**Sample Request:**

```bash
curl --location 'http://localhost:3000/nginx/create-config-file' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "templateFileName": "expressJs",
  "serverNamesArray": ["api.example.com", "www.api.example.com"],
  "appHostServerMachinePublicId": "b4e3c2d1-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
  "portNumber": 3000,
  "saveDestination": "/etc/nginx/sites-available"
}'
```

**Success Response (201 Created):**

```json
{
  "message": "Nginx config file created successfully",
  "filePath": "/etc/nginx/sites-available/api.example.com",
  "databaseRecord": {
    "_id": "507f1f77bcf86cd799439011",
    "publicId": "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
    "serverName": "api.example.com",
    "serverNameArrayOfAdditionalServerNames": ["www.api.example.com"],
    "portNumber": 3000,
    "appHostServerMachinePublicId": "b4e3c2d1-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "nginxHostServerMachinePublicId": "c5d4e3f2-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
    "framework": "ExpressJs",
    "storeDirectory": "/etc/nginx/sites-available",
    "createdAt": "2025-12-25T10:30:00.000Z",
    "updatedAt": "2025-12-25T10:30:00.000Z"
  }
}
```

**Error Response (400 Bad Request - Missing Fields):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing required fields: templateFileName, serverNamesArray, appHostServerMachinePublicId, portNumber, saveDestination",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Invalid Template):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid templateFileName",
    "details": "Must be one of: expressJs, nextJsPython",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Invalid Server Names):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "serverNamesArray must be a non-empty array",
    "status": 400
  }
}
```

**Error Response (404 Not Found - Machine Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Machine not found",
    "details": "Machine with specified appHostServerMachinePublicId not found",
    "status": 404
  }
}
```

**Error Response (400 Bad Request - Invalid Port):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "portNumber must be a number between 1 and 65535",
    "status": 400
  }
}
```

**Error Response (404 Not Found - Current Machine Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Current machine not found in database",
    "details": "Current IP: 192.168.1.50 (only in development mode)",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error - File Creation Failed):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to create nginx config file",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to create nginx config file",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates all required fields and data types
- Maps template type to actual template file (e.g., "expressJs" → "expressJsSitesAvailable.txt")
- Verifies template file exists before proceeding
- Retrieves `localIpAddress` from app host machine for template placeholders
- Creates physical nginx config file from template with replacements:
  - `<ReplaceMe: server name>` → Space-separated server names
  - `<ReplaceMe: local ip>` → App host machine's local IP
  - `<ReplaceMe: port number>` → Port number
- File saved as `{primaryServerName}` (no extension) in `saveDestination` directory
- Creates database record with auto-generated `publicId`
- Sets `framework` to "ExpressJs" (could be enhanced for template-based detection)
- Sets `nginxHostServerMachinePublicId` based on current machine's IP

---

## DELETE /nginx/clear

Clear all nginx configuration files from the database (does not delete physical files).

**Authentication:** Required (JWT token)

**Sample Request:**

```bash
curl --location --request DELETE 'http://localhost:3000/nginx/clear' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "message": "NginxFiles collection cleared successfully",
  "deletedCount": 12
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to clear nginx files",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Deletes all documents from NginxFile collection
- Does NOT delete physical nginx config files from filesystem
- Returns count of deleted database records

---

## DELETE /nginx/:publicId

Delete a specific nginx configuration file and its database record.

**Authentication:** Required (JWT token)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `publicId` | String | Yes | UUID v4 public identifier of the nginx config |

**Sample Request:**

```bash
curl --location --request DELETE 'http://localhost:3000/nginx/a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "message": "Nginx configuration deleted successfully",
  "serverName": "api.example.com",
  "filePath": "/etc/nginx/sites-available/api.example.com"
}
```

**Error Response (400 Bad Request - Invalid publicId):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid publicId format",
    "details": "publicId must be a valid UUID v4",
    "status": 400
  }
}
```

**Error Response (404 Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Configuration not found",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete nginx configuration",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Validates UUID v4 format for publicId parameter
- Looks up configuration using `publicId` field (not MongoDB `_id`)
- Constructs file path from `storeDirectory` + `serverName`
- Attempts to delete physical config file (continues if file doesn't exist)
- Always deletes database record even if physical file is missing
- Logs warning if file not found but doesn't fail the request
- Uses standardized error response format with code, message, details, and status fields
