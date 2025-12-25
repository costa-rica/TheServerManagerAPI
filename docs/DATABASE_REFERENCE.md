# Database Reference

## MongoDB Connection

The application uses Mongoose ODM to connect to MongoDB. The connection is established in `src/models/connection.ts` and initialized during application startup in `src/app.ts`.

**Connection Configuration:**
- **URI Source:** `MONGODB_URI` environment variable (required)
- **Connection Options:** `serverSelectionTimeoutMS: 2000`
- **Initialization:** Called via `connectDB()` function during `initializeApp()` in `src/app.ts`
- **Shared Database:** All server instances connect to the same MongoDB database for multi-machine coordination

**Error Handling:** Application exits with code 1 if MongoDB connection fails or if `MONGODB_URI` is missing.

## Collections

### Machine

Represents a physical or virtual server in the network.

**Collection Name:** `machines`

**Schema:**

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `publicId` | String | Yes | Yes | External API identifier |
| `machineName` | String | Yes | No | Human-readable name for the server |
| `urlFor404Api` | String | Yes | No | Fallback URL for 404 error handling |
| `localIpAddress` | String | Yes | No | Local IP address of the machine |
| `nginxStoragePathOptions` | Array[String] | No | No | Available paths for nginx config storage |
| `pathToLogs` | String | Yes | No | Directory path for application logs |
| `servicesArray` | Array[Object] | No | No | Systemd services running on this machine |
| `createdAt` | Date | Auto | No | Timestamp of document creation |
| `updatedAt` | Date | Auto | No | Timestamp of last update |

**servicesArray Object Structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | Yes | Service name |
| `filename` | String | Yes | Systemd service filename |
| `filenameTimer` | String | No | Associated timer filename (if applicable) |
| `port` | Number | No | Port number the service runs on |

**Model Location:** `src/models/machine.ts`

---

### NginxFile

Represents nginx configuration files tracked in the system.

**Collection Name:** `nginxfiles`

**Schema:**

| Field | Type | Required | Unique | References | Description |
|-------|------|----------|--------|------------|-------------|
| `publicId` | String | Yes | Yes | - | External API identifier |
| `serverName` | String | Yes | No | - | Primary domain/server name |
| `portNumber` | Number | Yes | No | - | Port number for the application |
| `serverNameArrayOfAdditionalServerNames` | Array[String] | No | No | - | Additional domains (aliases) |
| `appHostServerMachineId` | ObjectId | Yes | No | Machine | Machine where the application runs |
| `nginxHostServerMachineId` | ObjectId | Yes | No | Machine | Machine where nginx is hosted |
| `framework` | String | No | No | - | Application framework (e.g., "express", "nextjs", "python") |
| `storeDirectory` | String | No | No | - | Directory path where config is stored |
| `createdAt` | Date | Auto | No | - | Timestamp of document creation |
| `updatedAt` | Date | Auto | No | - | Timestamp of last update |

**Key Relationships:**
- `appHostServerMachineId` references the `Machine` collection (where the application runs)
- `nginxHostServerMachineId` references the `Machine` collection (where nginx reverse proxy runs)
- These two machines may be the same or different depending on deployment architecture

**Model Location:** `src/models/nginxFile.ts`

---

### User

Represents user accounts for API authentication and authorization.

**Collection Name:** `users`

**Schema:**

| Field | Type | Required | Unique | Default | Description |
|-------|------|----------|--------|---------|-------------|
| `publicId` | String | Yes | Yes | - | External API identifier |
| `email` | String | Yes | Yes | - | User's email address (used for login) |
| `username` | String | Yes | No | - | Display name |
| `password` | String | Yes | No | - | Bcrypt-hashed password |
| `isAdmin` | Boolean | No | No | `false` | Admin role flag for authorization |
| `createdAt` | Date | Auto | No | - | Timestamp of document creation |
| `updatedAt` | Date | Auto | No | - | Timestamp of last update |

**Security Notes:**
- Passwords are hashed using bcrypt before storage
- JWT authentication uses the `JWT_SECRET` environment variable
- Admin users can be auto-created on startup via `ADMIN_EMAIL` environment variable (JSON array)

**Model Location:** `src/models/user.ts`

---

## Common Schema Features

All collections include:
- **Timestamps:** Automatically managed `createdAt` and `updatedAt` fields via Mongoose `timestamps: true` option
- **Public IDs:** Each document has a `publicId` field (unique) used for external API references instead of exposing internal MongoDB `_id`
