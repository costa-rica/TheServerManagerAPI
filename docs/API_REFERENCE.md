# API Reference

This document provides comprehensive documentation for all available API endpoints in the The404-API API.

## Base URL

```
http://localhost:3000
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Table of Contents

- [Index Routes](#index-routes)
- [User Routes](#user-routes)
- [Machine Routes](#machine-routes)
- [Services Routes](#services-routes)
- [Nginx Routes](#nginx-routes)
- [Admin Routes](#admin-routes)
- [Registrar Routes](#registrar-routes)

---

## Index Routes

### GET /

Serves the main HTML page.

**Authentication:** Not required

**Request:**

```http
GET / HTTP/1.1
Host: localhost:3000
```

**Success Response (200 OK):**

```html
<!DOCTYPE html>
<html>
  <!-- HTML content -->
</html>
```

**Error Response (500 Internal Server Error):**

```json
{
  "error": "Internal server error"
}
```

---

## User Routes

### GET /users

Returns a simple message indicating the users endpoint is available.

**Authentication:** Not required

**Request:**

```http
GET /users HTTP/1.1
Host: localhost:3000
```

**Success Response (200 OK):**

```
users endpoint
```

---

### POST /users/register

Register a new user account.

**Authentication:** Not required

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/users/register' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "user@example.com",
  "password": "securePassword123"
}'
```

**Success Response (201 Created):**

```json
{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "user",
    "email": "user@example.com"
  }
}
```

**Error Responses:**

**400 Bad Request - Missing Fields:**

```json
{
  "error": "Missing email, password"
}
```

**400 Bad Request - User Already Exists:**

```json
{
  "error": "User already exists"
}
```

---

### POST /users/login

Authenticate and log in an existing user.

**Authentication:** Not required

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/users/login' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "user@example.com",
  "password": "securePassword123"
}'
```

**Success Response (200 OK):**

```json
{
  "message": "User logged in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "user",
    "email": "user@example.com",
    "isAdmin": false
  }
}
```

**Error Responses:**

**400 Bad Request - Missing Fields:**

```json
{
  "error": "Missing email, password"
}
```

**400 Bad Request - User Not Found:**

```json
{
  "error": "User not found"
}
```

**400 Bad Request - Invalid Password:**

```json
{
  "error": "Invalid password"
}
```

---

### POST /users/request-reset-password-email

Request a password reset email. Sends an email with a JWT token that expires in 1 hour.

**Authentication:** Not required

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/users/request-reset-password-email' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "user@example.com"
}'
```

**Success Response (200 OK):**

```json
{
  "message": "Email sent successfully"
}
```

**Error Responses:**

**400 Bad Request - Missing Email:**

```json
{
  "error": "Email is required."
}
```

**404 Not Found - User Not Found:**

```json
{
  "error": "User not found."
}
```

---

### POST /users/reset-password-with-new-password

Reset user password using the token from the reset email.

**Authentication:** Not required (uses JWT token from email)

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "newSecurePassword123"
}
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/users/reset-password-with-new-password' \
--header 'Content-Type: application/json' \
--data-raw '{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "newSecurePassword123"
}'
```

**Success Response (200 OK):**

```json
{
  "message": "Password reset successfully"
}
```

**Error Responses:**

**400 Bad Request - Missing Fields:**

```json
{
  "error": "Missing token, newPassword"
}
```

**401 Unauthorized - Invalid Token:**

```json
{
  "error": "Invalid or expired token."
}
```

**401 Unauthorized - Expired Token:**

```json
{
  "error": "Reset token has expired."
}
```

**404 Not Found - User Not Found:**

```json
{
  "error": "User not found."
}
```

**500 Internal Server Error:**

```json
{
  "error": "Internal server error"
}
```

---

## Machine Routes

### GET /machines/name

Get the current machine's hostname and local IP address using OS-level information.

**Authentication:** Required (JWT token)

**Request:**

```http
GET /machines/name HTTP/1.1
Host: localhost:3000
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/machines/name'
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

### GET /machines

Get all registered machines in the system.

**Authentication:** Required (JWT token)

**Request:**

```http
GET /machines HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

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
      "machineName": "ubuntu-server-01",
      "urlFor404Api": "http://192.168.1.100:8000",
      "localIpAddress": "192.168.1.100",
      "userHomeDir": "/home/ubuntu",
      "nginxStoragePathOptions": ["/var/www", "/home/user/sites"],
      "createdAt": "2025-10-23T10:30:00.000Z",
      "updatedAt": "2025-10-23T10:30:00.000Z"
    }
  ]
}
```

**Error Responses:**

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

---

### POST /machines

Register a new machine in the system. Automatically adds the machine name and local IP address from OS.

**Authentication:** Required (JWT token)

**Request Body:**

```json
{
  "urlFor404Api": "http://192.168.1.100:8000",
  "nginxStoragePathOptions": ["/var/www", "/home/user/sites"],
  "userHomeDir": "/home/ubuntu"
}
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/machines' \
--header 'Content-Type: application/json' \
--data-raw '{
  "urlFor404Api": "http://192.168.1.100:8000",
  "nginxStoragePathOptions": ["/var/www", "/home/user/sites"],
  "userHomeDir": "/home/ubuntu"
}'
```

**Success Response (201 Created):**

```json
{
  "message": "Machine created successfully",
  "machine": {
    "id": "507f1f77bcf86cd799439011",
    "machineName": "ubuntu-server-01",
    "urlFor404Api": "http://192.168.1.100:8000",
    "localIpAddress": "192.168.1.100",
    "userHomeDir": "/home/ubuntu",
    "nginxStoragePathOptions": ["/var/www", "/home/user/sites"],
    "createdAt": "2025-10-23T10:30:00.000Z",
    "updatedAt": "2025-10-23T10:30:00.000Z"
  }
}
```

**Error Responses:**

**400 Bad Request - Missing Fields:**

```json
{
  "error": "Missing urlFor404Api, nginxStoragePathOptions, userHomeDir"
}
```

**400 Bad Request - Invalid Array:**

```json
{
  "error": "nginxStoragePathOptions must be an array of strings"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to create machine"
}
```

---

### DELETE /machines/:id

Delete a machine from the system by its ID.

**Authentication:** Required (JWT token)

**URL Parameters:**

- `id` (string, required) - MongoDB ObjectId of the machine to delete

**Request:**

```http
DELETE /machines/507f1f77bcf86cd799439011 HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

```bash
curl --location --request DELETE 'http://localhost:3000/machines/507f1f77bcf86cd799439011' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "message": "Machine deleted successfully"
}
```

**Error Responses:**

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**404 Not Found - Machine Not Found:**

```json
{
  "error": "Machine not found"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to delete machine"
}
```

---

## Services Routes

## Nginx Routes

### GET /nginx

Get all nginx configuration files from the database with populated machine references.

**Authentication:** Required (JWT token)

**Request:**

```http
GET /nginx HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/nginx' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "serverName": "api.example.com",
    "serverNameArrayOfAdditionalServerNames": ["www.api.example.com"],
    "portNumber": 3000,
    "appHostServerMachineId": {
      "_id": "507f1f77bcf86cd799439012",
      "machineName": "ubuntu-server-01",
      "localIpAddress": "192.168.1.100"
    },
    "nginxHostServerMachineId": {
      "_id": "507f1f77bcf86cd799439013",
      "machineName": "nginx-server-01",
      "localIpAddress": "192.168.1.50"
    },
    "framework": "ExpressJs",
    "storeDirectory": "/etc/nginx/sites-available",
    "createdAt": "2025-10-23T10:30:00.000Z",
    "updatedAt": "2025-10-23T10:30:00.000Z"
  }
]
```

**Error Responses:**

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to fetch nginx files"
}
```

---

### GET /nginx/scan-nginx-dir

Scan the nginx directory for configuration files and parse them into the database. Reads files from `/etc/nginx/sites-available/`, parses each config file, and creates database entries for new configurations.

**Authentication:** Required (JWT token)

**Request:**

```http
GET /nginx/scan-nginx-dir HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

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
  "nginxHostMachineId": "507f1f77bcf86cd799439013",
  "reportPath": "/path/to/resources/status_reports/nginxConfigFileScanStatusSummary_2025-10-26T22-45-30-123Z.csv",
  "newEntries": [
    {
      "fileName": "api.example.com",
      "serverName": "api.example.com",
      "additionalServerNames": ["www.api.example.com"],
      "portNumber": 3000,
      "localIpAddress": "192.168.1.100",
      "framework": "ExpressJs",
      "appHostMachineFound": true,
      "databaseId": "507f1f77bcf86cd799439011"
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

**Notes:**

- Scans the directory specified in `PATH_ETC_NGINX_SITES_AVAILABLE` environment variable
- Automatically filters out the 'default' config file
- Parses each config file to extract server names, port, IP address, and framework
- Creates database entries only for new configurations (skips duplicates)
- Generates a CSV report saved to `PATH_PROJECT_RESOURCES/status_reports/` with details for each scanned file
- Returns detailed information about new entries, duplicates, and errors including the path to the generated CSV report

**Error Responses:**

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**404 Not Found - Current Machine Not Found:**

```json
{
  "error": "Current machine not found in database",
  "currentIp": "192.168.1.50"
}
```

**500 Internal Server Error - Directory Read Failed:**

```json
{
  "error": "Failed to read nginx directory: /etc/nginx/sites-available",
  "details": "ENOENT: no such file or directory"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to scan nginx directory"
}
```

---

### POST /nginx/create-config-file

Create a new nginx configuration file from a template and save it to the specified nginx directory.

**Authentication:** Required (JWT token)

**Request Body:**

```json
{
  "templateFileName": "expressJs",
  "serverNamesArray": ["api.example.com", "www.api.example.com"],
  "appHostServerMachineId": "507f1f77bcf86cd799439012",
  "portNumber": 3000,
  "saveDestination": "sites-available"
}
```

**Template Types:**

- `"expressJs"` - Uses `expressJsSitesAvailable.txt` template
- `"nextJsPython"` - Uses `nextJsPythonSitesAvailable.txt` template

**Request Example:**

```bash
curl --location 'http://localhost:3000/nginx/create-config-file' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "templateFileName": "expressJs",
  "serverNamesArray": ["api.example.com", "www.api.example.com"],
  "appHostServerMachineId": "507f1f77bcf86cd799439012",
  "portNumber": 3000,
  "saveDestination": "sites-available"
}'
```

**Success Response (201 Created):**

```json
{
  "message": "Nginx config file created successfully",
  "filePath": "/etc/nginx/sites-available/api.example.com",
  "databaseRecord": {
    "_id": "507f1f77bcf86cd799439011",
    "serverName": "api.example.com",
    "serverNameArrayOfAdditionalServerNames": ["www.api.example.com"],
    "portNumber": 3000,
    "appHostServerMachineId": "507f1f77bcf86cd799439012",
    "nginxHostServerMachineId": "507f1f77bcf86cd799439013",
    "framework": "ExpressJs",
    "storeDirectory": "/etc/nginx/sites-available",
    "createdAt": "2025-10-23T10:30:00.000Z",
    "updatedAt": "2025-10-23T10:30:00.000Z"
  }
}
```

**Notes:**

- `templateFileName` must be either `"expressJs"` or `"nextJsPython"`
- Template files must exist in the templates directory
- `saveDestination` must be a valid directory path (e.g., `"/etc/nginx/sites-available"`, `"/etc/nginx/conf.d"`, or any custom path)
- The machine specified by `appHostServerMachineId` must exist and have a `localIpAddress` field
- Creates both the physical nginx config file and a database record

**Error Responses:**

**400 Bad Request - Missing Fields:**

```json
{
  "error": "Missing templateFileName, serverNamesArray, appHostServerMachineId, portNumber, saveDestination"
}
```

**400 Bad Request - Invalid Template File Name:**

```json
{
  "error": "templateFileName must be a non-empty string"
}
```

**400 Bad Request - Invalid Template Type:**

```json
{
  "error": "Invalid templateFileName. Must be one of: expressJs, nextJsPython"
}
```

**400 Bad Request - Invalid Server Names Array:**

```json
{
  "error": "serverNamesArray must be a non-empty array"
}
```

**400 Bad Request - Invalid Server Names:**

```json
{
  "error": "All server names must be non-empty strings"
}
```

**400 Bad Request - Invalid Machine ID:**

```json
{
  "error": "appHostServerMachineId must be a valid ObjectId"
}
```

**400 Bad Request - Machine Not Found:**

```json
{
  "error": "Machine with specified appHostServerMachineId not found"
}
```

**400 Bad Request - Invalid Port Number:**

```json
{
  "error": "portNumber must be a number between 1 and 65535"
}
```

**400 Bad Request - Invalid Save Destination:**

```json
{
  "error": "saveDestination must be a non-empty string path"
}
```

**400 Bad Request - Template Not Found:**

```json
{
  "error": "Template file 'expressJsSitesAvailable.txt' not found"
}
```

**400 Bad Request - Missing Local IP:**

```json
{
  "error": "Machine document does not have a localIpAddress field"
}
```

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**404 Not Found - Current Machine Not Found:**

```json
{
  "error": "Current machine not found in database",
  "currentIp": "192.168.1.50"
}
```

**500 Internal Server Error - Config Creation Failed:**

```json
{
  "error": "Failed to create nginx config file",
  "details": "Error details here"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to create nginx config file"
}
```

---

### DELETE /nginx/:id

Delete a specific nginx configuration file and its database record by ID.

**Authentication:** Required (JWT token)

**URL Parameters:**

- `id` (string, required) - MongoDB ObjectId of the NginxFile document to delete

**Request:**

```http
DELETE /nginx/68fe4bc1307d3f3731af7c17 HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

```bash
curl --location --request DELETE 'http://localhost:3000/nginx/68fe4bc1307d3f3731af7c17' \
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

**Notes:**

- Deletes both the physical nginx config file AND the database record
- If the physical file doesn't exist, a warning is logged but deletion continues
- The database record is always deleted even if file deletion fails
- Returns the server name and file path of the deleted configuration

**Error Responses:**

**400 Bad Request - Invalid ID:**

```json
{
  "error": "Invalid configuration ID"
}
```

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**404 Not Found - Configuration Not Found:**

```json
{
  "error": "Configuration not found"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to delete nginx configuration"
}
```

---

### DELETE /nginx/clear

Clear all nginx configuration file records from the database. This does not delete the actual nginx config files from the filesystem.

**Authentication:** Required (JWT token)

**Request:**

```http
DELETE /nginx/clear HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

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

**Notes:**

- This operation only removes database records, not the actual nginx configuration files
- Returns the count of deleted records

**Error Responses:**

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to clear nginx files"
}
```

## Admin Routes

### GET /admin/downloads

List all files available for download in the status_reports directory.

**Authentication:** Required (JWT token)

**Request:**

```http
GET /admin/downloads HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/admin/downloads' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "directory": "/path/to/resources/status_reports",
  "fileCount": 3,
  "files": [
    {
      "fileName": "nginxConfigFileScanStatusSummary_2025-10-26T22-45-30-123Z.csv",
      "size": 15234,
      "sizeKB": "14.88",
      "modifiedDate": "2025-10-26T22:45:30.123Z",
      "isFile": true
    },
    {
      "fileName": "nginxConfigFileScanStatusSummary_2025-10-26T23-12-45-456Z.csv",
      "size": 18567,
      "sizeKB": "18.13",
      "modifiedDate": "2025-10-26T23:12:45.456Z",
      "isFile": true
    }
  ]
}
```

**Notes:**

- Returns all files from the `PATH_PROJECT_RESOURCES/status_reports/` directory
- Includes file metadata: name, size in bytes, size in KB, and modification date
- Only returns actual files (filters out directories)

**Error Responses:**

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**404 Not Found - Directory Not Found:**

```json
{
  "error": "Status reports directory not found",
  "path": "/path/to/resources/status_reports"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to list download files"
}
```

---

### GET /admin/downloads/:filename

Download a specific file from the status_reports directory.

**Authentication:** Required (JWT token)

**URL Parameters:**

- `filename` (string, required) - Name of the file to download

**Request:**

```http
GET /admin/downloads/nginxConfigFileScanStatusSummary_2025-10-26T22-45-30-123Z.csv HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/admin/downloads/nginxConfigFileScanStatusSummary_2025-10-26T22-45-30-123Z.csv' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--output report.csv
```

**Success Response (200 OK):**

The file is streamed as a download with appropriate headers:

- `Content-Disposition: attachment; filename="<filename>"`
- `Content-Type: application/octet-stream`
- `Content-Length: <file-size>`

**Notes:**

- Downloads files from the `PATH_PROJECT_RESOURCES/status_reports/` directory
- Filename is validated to prevent directory traversal attacks
- File is streamed directly to the client
- Suitable for downloading CSV reports and other status files

**Error Responses:**

**400 Bad Request - Invalid Filename:**

```json
{
  "error": "Invalid filename"
}
```

**400 Bad Request - Not a File:**

```json
{
  "error": "Not a file"
}
```

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**404 Not Found - File Not Found:**

```json
{
  "error": "File not found"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to download file"
}
```

---

## Registrar Routes

### GET /registrar/get-all-porkbun-domains

Fetch all domains from Porkbun registrar account and return simplified domain information.

**Authentication:** Required (JWT token)

**Request:**

```http
GET /registrar/get-all-porkbun-domains HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/registrar/get-all-porkbun-domains' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "domainsArray": [
    {
      "domain": "dashanddata.com",
      "status": "ACTIVE"
    },
    {
      "domain": "tu-rincon.com",
      "status": "ACTIVE"
    }
  ]
}
```

**Notes:**

- Makes an authenticated request to Porkbun API using `PORKBUN_API_KEY` and `PORKBUN_SECRET_KEY` environment variables
- Returns only domain name and status from the full Porkbun response
- Porkbun API endpoint: `https://api.porkbun.com/api/json/v3/domain/listAll`

**Error Responses:**

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**500 Internal Server Error - Missing Credentials:**

```json
{
  "errorFrom": "The404-API",
  "error": "Porkbun API credentials not configured"
}
```

**500 Internal Server Error - Porkbun Error:**

```json
{
  "errorFrom": "porkbun",
  "error": "Invalid API credentials"
}
```

**500 Internal Server Error - Unexpected Response:**

```json
{
  "errorFrom": "The404-API",
  "error": "Unexpected response from Porkbun API"
}
```

**500 Internal Server Error:**

```json
{
  "errorFrom": "The404-API",
  "error": "Internal server error"
}
```

---

### POST /registrar/create-subdomain

Create a new DNS subdomain record on Porkbun for a specific domain.

**Authentication:** Required (JWT token)

**Request Body:**

```json
{
  "domain": "tu-rincon.com",
  "subdomain": "api",
  "publicIpAddress": "192.168.1.100",
  "type": "A"
}
```

**Field Descriptions:**

- `domain` (string, required) - The root domain (e.g., "tu-rincon.com")
- `subdomain` (string, required) - The subdomain name (e.g., "api" for "api.tu-rincon.com")
- `publicIpAddress` (string, required) - The IP address or target for the DNS record
- `type` (string, required) - The DNS record type (e.g., "A", "CNAME", "TXT", etc.)

**Request Example:**

```bash
curl --location 'http://localhost:3000/registrar/create-subdomain' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "domain": "tu-rincon.com",
  "subdomain": "api",
  "publicIpAddress": "192.168.1.100",
  "type": "A"
}'
```

**Success Response (201 Created):**

```json
{
  "message": "Subdomain created successfully",
  "recordId": "12345678",
  "domain": "tu-rincon.com",
  "subdomain": "api",
  "type": "A",
  "publicIpAddress": "192.168.1.100",
  "ttl": 600
}
```

**Notes:**

- Makes an authenticated request to Porkbun API using `PORKBUN_API_KEY` and `PORKBUN_SECRET_KEY` environment variables
- TTL is automatically set to 600 seconds (10 minutes)
- Porkbun API endpoint: `https://api.porkbun.com/api/json/v3/dns/create/{domain}`
- Common DNS record types: "A" (IPv4), "AAAA" (IPv6), "CNAME" (alias), "TXT" (text), "MX" (mail)

**Error Responses:**

**400 Bad Request - Missing Fields:**

```json
{
  "errorFrom": "The404-API",
  "error": "Missing domain, subdomain, publicIpAddress, type"
}
```

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**500 Internal Server Error - Missing Credentials:**

```json
{
  "errorFrom": "The404-API",
  "error": "Porkbun API credentials not configured"
}
```

**500 Internal Server Error - Porkbun Error:**

```json
{
  "errorFrom": "porkbun",
  "error": "Invalid domain or DNS record"
}
```

**500 Internal Server Error - Unexpected Response:**

```json
{
  "errorFrom": "The404-API",
  "error": "Unexpected response from Porkbun API"
}
```

**500 Internal Server Error:**

```json
{
  "errorFrom": "The404-API",
  "error": "Internal server error"
}
```

---

### GET /registrar/get-all-porkbun-subdomains/:domain

Retrieve all DNS records (subdomains) for a specific domain from Porkbun.

**Authentication:** Required (JWT token)

**URL Parameters:**

- `domain` (string, required) - The domain name to retrieve DNS records for (e.g., "tu-rincon.com")

**Request:**

```http
GET /registrar/get-all-porkbun-subdomains/tu-rincon.com HTTP/1.1
Host: localhost:3000
Authorization: Bearer <your_jwt_token>
```

**Request Example:**

```bash
curl --location 'http://localhost:3000/registrar/get-all-porkbun-subdomains/tu-rincon.com' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "subdomainsArray": [
    {
      "name": "api.tu-rincon.com",
      "type": "A",
      "content": "69.207.163.8"
    },
    {
      "name": "test.dev.api.tu-rincon.com",
      "type": "A",
      "content": "69.207.163.8"
    },
    {
      "name": "tu-rincon.com",
      "type": "A",
      "content": "69.207.163.8"
    },
    {
      "name": "tu-rincon.com",
      "type": "NS",
      "content": "curitiba.porkbun.com"
    }
  ]
}
```

**Notes:**

- Makes an authenticated request to Porkbun API using `PORKBUN_API_KEY` and `PORKBUN_SECRET_KEY` environment variables
- Returns only `name`, `type`, and `content` fields from each DNS record
- Porkbun API endpoint: `https://api.porkbun.com/api/json/v3/dns/retrieve/{domain}`
- Includes all DNS record types: A, AAAA, CNAME, MX, TXT, NS, etc.

**Error Responses:**

**400 Bad Request - Missing Domain:**

```json
{
  "errorFrom": "The404-API",
  "error": "Domain parameter is required"
}
```

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**500 Internal Server Error - Missing Credentials:**

```json
{
  "errorFrom": "The404-API",
  "error": "Porkbun API credentials not configured"
}
```

**500 Internal Server Error - Porkbun Error:**

```json
{
  "errorFrom": "porkbun",
  "error": "Domain is not opted in to API access."
}
```

**500 Internal Server Error - Unexpected Response:**

```json
{
  "errorFrom": "The404-API",
  "error": "Unexpected response from Porkbun API"
}
```

**500 Internal Server Error:**

```json
{
  "errorFrom": "The404-API",
  "error": "Internal server error"
}
```

---

### DELETE /registrar/porkbun-subdomain

Delete a specific DNS subdomain record from Porkbun by domain, type, and subdomain name.

**Authentication:** Required (JWT token)

**Request Body:**

```json
{
  "domain": "tu-rincon.com",
  "type": "A",
  "subdomain": "api"
}
```

**Field Descriptions:**

- `domain` (string, required) - The root domain (e.g., "tu-rincon.com")
- `type` (string, required) - The DNS record type (e.g., "A", "CNAME", "TXT", etc.)
- `subdomain` (string, required) - The subdomain name (e.g., "api" for "api.tu-rincon.com")

**Request Example:**

```bash
curl --location --request DELETE 'http://localhost:3000/registrar/porkbun-subdomain' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "domain": "tu-rincon.com",
  "type": "A",
  "subdomain": "api"
}'
```

**Success Response (200 OK):**

```json
{
  "message": "DNS record deleted successfully",
  "domain": "tu-rincon.com",
  "type": "A",
  "subdomain": "api"
}
```

**Notes:**

- Makes an authenticated request to Porkbun API using `PORKBUN_API_KEY` and `PORKBUN_SECRET_KEY` environment variables
- Porkbun API endpoint: `https://api.porkbun.com/api/json/v3/dns/deleteByNameType/{domain}/{type}/{subdomain}`
- Deletes the DNS record matching the exact domain, type, and subdomain combination

**Error Responses:**

**400 Bad Request - Missing Fields:**

```json
{
  "errorFrom": "The404-API",
  "error": "Missing domain, type, subdomain"
}
```

**401 Unauthorized - Missing or Invalid Token:**

```json
{
  "error": "Access denied. No token provided."
}
```

**500 Internal Server Error - Missing Credentials:**

```json
{
  "errorFrom": "The404-API",
  "error": "Porkbun API credentials not configured"
}
```

**500 Internal Server Error - Porkbun Error:**

```json
{
  "errorFrom": "porkbun",
  "error": "Record not found or already deleted"
}
```

**500 Internal Server Error - Unexpected Response:**

```json
{
  "errorFrom": "The404-API",
  "error": "Unexpected response from Porkbun API"
}
```

**500 Internal Server Error:**

```json
{
  "errorFrom": "The404-API",
  "error": "Internal server error"
}
```
