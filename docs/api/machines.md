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
| `servicesArray[].name` | String | Yes* | Human-readable service name |
| `servicesArray[].filename` | String | Yes* | Systemd service filename (e.g., "app.service") |
| `servicesArray[].pathToLogs` | String | Yes* | Path to service log directory |
| `servicesArray[].filenameTimer` | String | No | Systemd timer filename if applicable |
| `servicesArray[].port` | Number | No | Port number the service runs on |

*Required if `servicesArray` is provided

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
      "name": "PersonalWeb03 API",
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
  "error": "Service at index 0 is missing required fields: name, filename, pathToLogs"
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
- Validates each service object in `servicesArray` if provided
- Returns empty `servicesArray` if not provided in request

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
| `servicesArray` | Object[] | Array of systemd service configurations (same structure as POST) |

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
    "servicesArray": [],
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
