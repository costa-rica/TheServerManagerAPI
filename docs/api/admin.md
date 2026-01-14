# Admin Routes

Administrative endpoints for managing user permissions and access control. All endpoints require admin authorization (isAdmin=true).

---

## GET /admin/users

Get all users with their permission details for user management.

**Authentication:** Required (JWT token with isAdmin=true)

**Sample Request:**

```bash
curl --location 'http://localhost:3000/admin/users' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "users": [
    {
      "publicId": "user-123-abc",
      "email": "user@example.com",
      "username": "user",
      "isAdmin": false,
      "accessServersArray": [
        "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
        "b4g3c2d5-6e7f-8g9a-0c1d-2e3f4a5b6c7d"
      ],
      "accessPagesArray": ["/dns/nginx", "/servers/services"]
    },
    {
      "publicId": "admin-456-def",
      "email": "admin@example.com",
      "username": "admin",
      "isAdmin": true,
      "accessServersArray": [],
      "accessPagesArray": []
    }
  ]
}
```

**Error Response (401 Unauthorized - Not Authenticated):**

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication required",
    "status": 401
  }
}
```

**Error Response (403 Forbidden - Not Admin):**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required",
    "status": 403
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve users",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Returns all users in the system regardless of permissions
- Excludes password field for security
- Admin users typically have empty permission arrays (full access by default)
- Non-admin users have populated permission arrays
- Used by admin UI to display user management table

---

## PATCH /admin/user/:userId/access-servers

Update a user's server access permissions by replacing the entire accessServersArray.

**Authentication:** Required (JWT token with isAdmin=true)

**URL Parameters:**

| Parameter | Type   | Required | Description                     |
| --------- | ------ | -------- | ------------------------------- |
| `userId`  | String | Yes      | Public ID of the user to update |

**Request Body Fields:**

| Field                 | Type     | Required | Description                                       |
| --------------------- | -------- | -------- | ------------------------------------------------- |
| `accessServersArray`  | String[] | Yes      | Array of machine publicIds the user can access    |

**Sample Request:**

```bash
curl --location --request PATCH 'http://localhost:3000/admin/user/user-123-abc/access-servers' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "accessServersArray": [
    "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
    "c5h4d3e6-7f8g-9h0b-1d2e-3f4g5h6i7j8k"
  ]
}'
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Server access updated",
  "user": {
    "publicId": "user-123-abc",
    "email": "user@example.com",
    "accessServersArray": [
      "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
      "c5h4d3e6-7f8g-9h0b-1d2e-3f4g5h6i7j8k"
    ]
  }
}
```

**Error Response (400 Bad Request - Missing Field):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing required fields: accessServersArray",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Invalid Array):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "accessServersArray must be an array of strings",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Invalid Machine publicIds):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid machine publicIds",
    "details": "The following publicIds do not exist: invalid-id-123, invalid-id-456",
    "status": 400
  }
}
```

**Error Response (403 Forbidden - Not Admin):**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required",
    "status": 403
  }
}
```

**Error Response (404 Not Found - User Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to update server access",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Completely replaces the user's `accessServersArray` (not a merge)
- Validates all machine publicIds exist in the database before updating
- Returns error if any publicId doesn't exist (atomic operation)
- Empty array is valid (removes all server access)
- Does not affect admin users' access (they have full access regardless)
- Changes take effect immediately for new API requests

---

## PATCH /admin/user/:userId/access-pages

Update a user's page access permissions by replacing the entire accessPagesArray.

**Authentication:** Required (JWT token with isAdmin=true)

**URL Parameters:**

| Parameter | Type   | Required | Description                     |
| --------- | ------ | -------- | ------------------------------- |
| `userId`  | String | Yes      | Public ID of the user to update |

**Request Body Fields:**

| Field               | Type     | Required | Description                                    |
| ------------------- | -------- | -------- | ---------------------------------------------- |
| `accessPagesArray`  | String[] | Yes      | Array of page paths the user can access        |

**Sample Request:**

```bash
curl --location --request PATCH 'http://localhost:3000/admin/user/user-123-abc/access-pages' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "accessPagesArray": [
    "/dns/nginx",
    "/dns/registrar",
    "/servers/services"
  ]
}'
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Page access updated",
  "user": {
    "publicId": "user-123-abc",
    "email": "user@example.com",
    "accessPagesArray": [
      "/dns/nginx",
      "/dns/registrar",
      "/servers/services"
    ]
  }
}
```

**Error Response (400 Bad Request - Missing Field):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing required fields: accessPagesArray",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Invalid Array):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "accessPagesArray must be an array of strings",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Invalid Page Path):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid page path",
    "details": "Page path \"/invalid path\" is invalid. Must contain no spaces and only \"/\", \"-\", \".\", or alphanumerics.",
    "status": 400
  }
}
```

**Error Response (403 Forbidden - Not Admin):**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required",
    "status": 403
  }
}
```

**Error Response (404 Not Found - User Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to update page access",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Completely replaces the user's `accessPagesArray` (not a merge)
- Validates page paths contain only alphanumerics, `/`, `-`, `.` (no spaces)
- Returns error if any path is invalid (atomic operation)
- Empty array is valid (removes all page access)
- Does not affect admin users' access (they have full access regardless)
- Changes take effect immediately for frontend permission checks
- Path validation prevents injection attacks and ensures clean URLs

---

## GET /admin/downloads

List all files in the status_reports directory for download.

**Authentication:** Required (JWT token)

**Sample Request:**

```bash
curl --location 'http://localhost:3000/admin/downloads' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "directory": "/path/to/status_reports",
  "fileCount": 3,
  "files": [
    {
      "fileName": "nginx_scan_2025-12-25.json",
      "size": 15360,
      "sizeKB": "15.00",
      "modifiedDate": "2025-12-25T14:30:00.000Z",
      "isFile": true
    },
    {
      "fileName": "machine_report_2025-12-26.json",
      "size": 8192,
      "sizeKB": "8.00",
      "modifiedDate": "2025-12-26T10:15:00.000Z",
      "isFile": true
    }
  ]
}
```

**Error Response (404 Not Found - Directory Missing):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Status reports directory not found",
    "details": "Path: /path/to/status_reports",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to list download files",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Lists files in `PATH_PROJECT_RESOURCES/status_reports` directory
- Returns only files (filters out subdirectories)
- Provides file size in bytes and kilobytes
- Includes modification timestamp
- Available to all authenticated users (not admin-only)

---

## GET /admin/downloads/:filename

Download a specific file from the status_reports directory.

**Authentication:** Required (JWT token)

**URL Parameters:**

| Parameter  | Type   | Required | Description                   |
| ---------- | ------ | -------- | ----------------------------- |
| `filename` | String | Yes      | Name of the file to download  |

**Sample Request:**

```bash
curl --location 'http://localhost:3000/admin/downloads/nginx_scan_2025-12-25.json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--output nginx_scan_2025-12-25.json
```

**Success Response (200 OK):**

Returns the file contents as a stream with headers:
- `Content-Disposition: attachment; filename="nginx_scan_2025-12-25.json"`
- `Content-Type: application/octet-stream`
- `Content-Length: 15360`

**Error Response (400 Bad Request - Invalid Filename):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid filename",
    "details": "Filename cannot contain path traversal characters",
    "status": 400
  }
}
```

**Error Response (400 Bad Request - Not a File):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Requested path is not a file",
    "status": 400
  }
}
```

**Error Response (404 Not Found):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "File not found",
    "status": 404
  }
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to download file",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Streams file from `PATH_PROJECT_RESOURCES/status_reports/{filename}`
- Validates filename to prevent directory traversal attacks (rejects `..`, `/`, `\`)
- Sets appropriate headers for file download
- Available to all authenticated users (not admin-only)
- Does not load entire file into memory (uses streaming)
