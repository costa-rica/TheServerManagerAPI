# Database Reference

## MongoDB Connection

The application uses Mongoose to connect to MongoDB with the following configuration:

**Location:** `src/models/connection.ts`

**Connection Method:**

```typescript
await mongoose.connect(uri, {
  serverSelectionTimeoutMS: 2000,
});
```

**Required Environment Variable:**

- `MONGODB_URI` - MongoDB connection string (shared across all server instances)

**Behavior:**

- Connection is established during application startup via `connectDB()` function called in `src/app.ts`
- Application exits with code 1 if connection fails
- Connection is shared across all server instances in the network

---

## Collections

### Machine

Represents a physical or virtual server in the network.

**Model:** `src/models/machine.ts`

| Field                              | Type     | Required | Unique | Description                                       |
| ---------------------------------- | -------- | -------- | ------ | ------------------------------------------------- |
| `publicId`                         | String   | Yes      | Yes    | Public identifier for the machine                 |
| `machineName`                      | String   | Yes      | No     | Human-readable name for the server                |
| `urlFor404Api`                     | String   | Yes      | No     | API endpoint for 404 error handling               |
| `localIpAddress`                   | String   | Yes      | No     | Local IP address of the server                    |
| `nginxStoragePathOptions`          | String[] | No       | No     | Array of available nginx storage paths            |
| `servicesArray`                    | Object[] | No       | No     | Array of systemd services running on this machine |
| `servicesArray[].name`             | String   | No       | No     | Service name                                      |
| `servicesArray[].filename`         | String   | Yes      | No     | Service unit file name                            |
| `servicesArray[].filenameTimer`    | String   | No       | No     | Timer unit file name (if applicable)              |
| `servicesArray[].workingDirectory` | String   | No       | No     | Working directory for the service                 |
| `servicesArray[].port`             | Number   | No       | No     | Port the service runs on                          |
| `servicesArray[].pathToLogs`       | String   | Yes      | No     | Path to service log files                         |
| `createdAt`                        | Date     | Auto     | No     | Timestamp of document creation                    |
| `updatedAt`                        | Date     | Auto     | No     | Timestamp of last update                          |

---

### NginxFile

Represents an nginx configuration file tracked in the system.

**Model:** `src/models/nginxFile.ts`

| Field                                    | Type     | Required | Unique | Description                                       |
| ---------------------------------------- | -------- | -------- | ------ | ------------------------------------------------- |
| `publicId`                               | String   | Yes      | Yes    | Public identifier for the nginx config            |
| `serverName`                             | String   | Yes      | No     | Primary server name (domain)                      |
| `portNumber`                             | Number   | Yes      | No     | Port the application listens on                   |
| `serverNameArrayOfAdditionalServerNames` | String[] | No       | No     | Additional server names/aliases                   |
| `appHostServerMachinePublicId`           | String   | Yes      | No     | Machine publicId where the app runs               |
| `nginxHostServerMachinePublicId`         | String   | Yes      | No     | Machine publicId where nginx runs                 |
| `framework`                              | String   | No       | No     | Application framework (e.g., "express", "nextjs") |
| `storeDirectory`                         | String   | No       | No     | Directory where config is stored                  |
| `createdAt`                              | Date     | Auto     | No     | Timestamp of document creation                    |
| `updatedAt`                              | Date     | Auto     | No     | Timestamp of last update                          |

**Note:** Each NginxFile references TWO machines - one for the application host and one for the nginx host, enabling distributed configurations.

---

### User

Represents authenticated users with optional admin privileges.

**Model:** `src/models/user.ts`

| Field       | Type    | Required | Unique | Default | Description                           |
| ----------- | ------- | -------- | ------ | ------- | ------------------------------------- |
| `publicId`  | String  | Yes      | Yes    | -       | Public identifier for the user        |
| `email`     | String  | Yes      | Yes    | -       | User email address (login credential) |
| `username`  | String  | Yes      | No     | -       | Display name                          |
| `password`  | String  | Yes      | No     | -       | Bcrypt-hashed password                |
| `isAdmin`   | Boolean | No       | No     | `false` | Admin role flag for authorization     |
| `createdAt` | Date    | Auto     | No     | -       | Timestamp of document creation        |
| `updatedAt` | Date    | Auto     | No     | -       | Timestamp of last update              |

**Security Notes:**

- Passwords are hashed using bcrypt before storage
- Admin users can be auto-created on startup via `ADMIN_EMAIL` environment variable
- JWT tokens are signed using `JWT_SECRET` environment variable
