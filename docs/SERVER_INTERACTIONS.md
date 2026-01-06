# Server Interactions

This document details how The Server Manager API interacts with the Ubuntu 24.04 LTS server operating system, including privilege management and system-level operations.

---

## Sudoers Privilege Management

### Overview

The Server Manager API requires elevated privileges to manage systemd services and write system configuration files. Rather than running the entire application as root (a security risk), we use sudo with passwordless permissions for specific commands.

### CSV-Driven Privilege Configuration

Sudo privileges are managed through a CSV file located at `/home/nick/nick-systemctl.csv`. This file defines which commands the `nick` user can execute with sudo without entering a password.

**CSV Structure:**

```csv
user,runas,tag,command,action,unit
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,restart,tsm-api.service
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,status,tsm-api.service
nick,ALL=(root),NOPASSWD:,/usr/bin/mv,/home/nick/*.service,/etc/systemd/system/
nick,ALL=(root),NOPASSWD:,/usr/bin/mv,/home/nick/*.timer,/etc/systemd/system/
nick,ALL=(root),NOPASSWD:,/usr/bin/cat,/etc/systemd/system/*.service,
nick,ALL=(root),NOPASSWD:,/usr/bin/cat,/etc/systemd/system/*.timer,
nick,ALL=(root),NOPASSWD:,/usr/bin/cat,/etc/nginx/sites-available/*,
nick,ALL=(root),NOPASSWD:,/usr/bin/cp,/etc/nginx/sites-available/*,/etc/nginx/sites-available/*.backup.*
nick,ALL=(root),NOPASSWD:,/usr/bin/mv,/home/nick/*,/etc/nginx/sites-available/
nick,ALL=(root),NOPASSWD:,/usr/bin/mv,/etc/nginx/sites-available/*.backup.*,/etc/nginx/sites-available/*
nick,ALL=(root),NOPASSWD:,/usr/bin/rm,/etc/nginx/sites-available/*.backup.*,
```

Each row specifies:

- **user**: Username that gets the privilege (nick)
- **runas**: Execution context (ALL=(root) means run as root)
- **tag**: Permission modifier (NOPASSWD: means no password required)
- **command**: Full path to the command (/usr/bin/systemctl or /usr/bin/mv)
- **action**: The systemctl action or source path pattern for mv
- **unit**: The specific service/timer file or destination directory

### Update Script

The executable POSIX script at `/home/nick/update-nick-systemctl.sh` automates the conversion of the CSV file into a proper sudoers configuration:

```bash
#!/usr/bin/env bash
set -euo pipefail

CSV="/home/nick/nick-systemctl.csv"
DEST="/etc/sudoers.d/nick-systemctl"
TMP="$(mktemp)"

tail -n +2 "$CSV" | tr -d '\r' | \
while IFS=, read -r user runas tag cmd action unit || [[ -n "$user" ]]; do
  echo "$user $runas $tag $cmd $action $unit"
done > "$TMP"

sudo visudo -cf "$TMP"
sudo install -m 440 "$TMP" "$DEST"
rm -f "$TMP"
```

**How it works:**

1. Reads CSV file, skipping the header row
2. Removes Windows line endings (if present)
3. Parses CSV and outputs space-separated sudoers rules
4. Validates syntax using `visudo -c` (prevents breaking sudo)
5. Installs the file to `/etc/sudoers.d/nick-systemctl` with secure permissions (440)
6. Cleans up temporary file

**Usage:**

```bash
# After modifying nick-systemctl.csv, run:
/home/nick/update-nick-systemctl.sh
```

### Why This Approach

**Security Benefits:**

- Application runs as regular user (nick), not root
- Only specific commands can be executed with sudo
- Wildcards are controlled (e.g., `*.service` not `*`)
- CSV is version-controllable and auditable
- Automatic syntax validation prevents configuration errors

**Operational Benefits:**

- Easy to add new service-specific permissions
- Changes don't require manual sudoers editing
- Reduces risk of typos in sudoers file
- Script ensures consistent formatting

---

## Service File Generation

### POST /services/make-service-file

This endpoint generates systemd service and timer files from templates, automatically writing them to `/etc/systemd/system/` using sudo privileges.

### Sudo Requirements

The endpoint requires these sudo privileges to write files to the system directory:

```csv
nick,ALL=(root),NOPASSWD:,/usr/bin/mv,/home/nick/*.service,/etc/systemd/system/
nick,ALL=(root),NOPASSWD:,/usr/bin/mv,/home/nick/*.timer,/etc/systemd/system/
```

### How It Works

**Write Strategy:**

1. API reads template from `dist/templates/systemdServiceFiles/`
2. Replaces placeholders (`{{PROJECT_NAME}}`, `{{PORT}}`, etc.) with provided values
3. Auto-generates lowercase filename: `NewsNexusRequesterGoogleRss02` → `newsnexusrequestergooglerss02.service`
4. Writes file to `/home/nick/[projectname].service` (no sudo needed, nick owns this directory)
5. Executes: `sudo mv "/home/nick/[projectname].service" "/etc/systemd/system/"`
6. File now exists at `/etc/systemd/system/[projectname].service` with proper permissions

**Why This Pattern:**

- Node.js cannot write directly to `/etc/systemd/system/` (permission denied)
- Sudo mv requires exact command matching in sudoers
- Writing to `/home/nick/` first avoids complex shell escaping
- Single sudo command minimizes security surface

**Exact Command Matching:**

Sudo is strict about matching commands. The sudoers rule:

```
nick ALL=(root) NOPASSWD: /usr/bin/mv /home/nick/*.service /etc/systemd/system/
```

Matches this command:

```bash
sudo mv "/home/nick/file.service" "/etc/systemd/system/"
```

But NOT this command:

```bash
sudo mv "/home/nick/file.service" "/etc/systemd/system/file.service"
```

The destination must be the directory path (trailing slash), not the full file path. This is why the code uses `"/etc/systemd/system/"` instead of `"/etc/systemd/system/[filename]"`.

### Logging

The endpoint logs the exact sudo command executed:

```
[systemd.ts] Executing command: sudo mv "/home/nick/newsnexusrequestergooglerss02.service" "/etc/systemd/system/"
```

This helps diagnose permission issues and verify correct command syntax.

---

## Service Control

### POST /services/control/:serviceFilename/:toggleStatus

This endpoint controls systemd services by executing `systemctl` commands (start, stop, restart, enable, disable, reload).

### Sudo Requirements

Each service and action combination requires a specific sudoers entry. Example for a service named `newsnexus-requestergnews02.timer`:

```csv
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,start,newsnexus-requestergnews02.timer
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,stop,newsnexus-requestergnews02.timer
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,restart,newsnexus-requestergnews02.timer
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,status,newsnexus-requestergnews02.timer
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,enable,newsnexus-requestergnews02.timer
nick,ALL=(root),NOPASSWD:,/usr/bin/systemctl,disable,newsnexus-requestergnews02.timer
```

### How It Works

**Execution Flow:**

1. API receives request: `POST /services/myapp.service/restart`
2. Validates service exists in machine's `servicesArray` in MongoDB
3. Validates action is one of: start, stop, restart, reload, enable, disable
4. Executes: `sudo systemctl restart myapp.service`
5. Queries updated status: `sudo systemctl status myapp.service`
6. Parses output and returns JSON with service state

**Special Handling for Critical Services:**

The API protects critical services (`tsm-api.service` and `tsm-nextjs.service`) from being stopped:

```javascript
// User requests: POST /services/tsm-api.service/stop
// API automatically converts to: sudo systemctl restart tsm-api.service
```

This ensures the API and web interface remain accessible even if someone tries to stop them.

### Service Status Parsing

After each action, the API queries `systemctl status` and parses:

- **Loaded:** Whether service file exists and is enabled/disabled for boot
- **Active:** Current state (active/inactive/failed) with timestamp
- **Status:** Simplified state extracted from Active line
- **Timer fields:** If the service has an associated timer, additional timer status fields are included

### Permission Granularity

Unlike the service file generation endpoint (which uses wildcards), service control requires explicit permissions for each service. This is intentional:

- **Service generation:** Low risk, just writes configuration files
- **Service control:** High risk, can stop critical services

To add a new service to the control system:

1. Add 6 rows to `nick-systemctl.csv` (one per action: start, stop, restart, status, enable, disable)
2. Run `/home/nick/update-nick-systemctl.sh` to apply changes
3. Add service to machine's `servicesArray` in MongoDB

This granular approach provides audit trails showing exactly which services can be controlled and prevents unauthorized service manipulation.

---

## Service File Management

### GET /services/service-file/:filename and POST /services/service-file/:filename

These endpoints enable reading and updating systemd service and timer files directly through the API. They complement the generation endpoint by allowing modification of existing files.

### Sudo Requirements

Reading service files requires:

```csv
nick,ALL=(root),NOPASSWD:,/usr/bin/cat,/etc/systemd/system/*.service,
nick,ALL=(root),NOPASSWD:,/usr/bin/cat,/etc/systemd/system/*.timer,
```

Updating uses the same `mv` permissions as file generation (already configured):

```csv
nick,ALL=(root),NOPASSWD:,/usr/bin/mv,/home/nick/*.service,/etc/systemd/system/
nick,ALL=(root),NOPASSWD:,/usr/bin/mv,/home/nick/*.timer,/etc/systemd/system/
```

### How It Works

**GET Endpoint:**

- Accepts either `.service` or `.timer` filename
- Parses base name and searches for both file types
- Uses `sudo cat /etc/systemd/system/{filename}` to read files
- Returns both files if they exist, or `null` for missing files
- Enables retrieving current file contents before editing

**POST Endpoint:**

- Updates existing service or timer files only (will not create new files)
- Validates filename exists in current machine's `servicesArray`
- Checks file exists before allowing update
- Writes to `/home/nick/{filename}` then uses `sudo mv` to system directory
- Prevents unauthorized file creation by requiring pre-existing files

**Typical Workflow:**

1. Use GET to retrieve current file contents
2. Modify contents in frontend
3. Use POST to update the file
4. Run `systemctl daemon-reload` to reload systemd configuration
5. Restart the service to apply changes

This approach provides a safe edit workflow while maintaining security through validation and sudo permissions.

---

## Environment File Management

### GET /services/env-file/:name and POST /services/env-file/:name

These endpoints enable reading and updating `.env` and `.env.local` files in the service's working directory. Unlike systemd service files, these do not require sudo permissions since they reside in user-accessible directories.

### No Sudo Required

Environment files are stored in the service's `workingDirectory` (as configured in the machine's `servicesArray`), which is typically owned by the application user (e.g., `/home/nick/my-app/`). Therefore:

- No sudo permissions needed for reading or writing
- Files are accessed using standard Node.js `fs` API
- Direct file system access without shell commands

### How It Works

**GET Endpoint:**

- Accepts service `name` from machine's `servicesArray`
- Queries database to find service by name
- Retrieves `workingDirectory` from service configuration
- Attempts to read both `.env` and `.env.local` files
- Returns response with 4 fields:
  - `env`: Contents of `.env` file (or `null` if not found)
  - `envStatus`: `true` if `.env` exists, `false` otherwise
  - `envLocal`: Contents of `.env.local` file (or `null` if not found)
  - `envLocalStatus`: `true` if `.env.local` exists, `false` otherwise
- Either or both files can be missing without causing errors

**POST Endpoint:**

- Accepts service `name` and file contents in request body: `{ env, envLocal }`
- Either or both fields can be provided
- Validates content against character whitelist (alphanumeric plus: `_ = # . - : / " ' @ space newline tab`)
- Finds service's `workingDirectory` from database
- Writes `.env` if `env` field provided (creates file if doesn't exist)
- Writes `.env.local` if `envLocal` field provided (creates file if doesn't exist)
- Returns success with `envWritten` and `envLocalWritten` boolean flags

**Security Validations:**

- Character whitelist prevents shell injection and malicious content
- Service name must exist in machine's `servicesArray`
- Working directory must be configured for the service
- Content type validation ensures strings only
- Invalid characters are rejected before file write

**Typical Workflow:**

1. Frontend calls GET to retrieve current `.env` and `.env.local` contents
2. User edits environment variables in the UI
3. Frontend calls POST with updated content(s)
4. Service restart required to load new environment variables
5. Use POST `/services/control/:serviceFilename/restart` to apply changes

### Example Response Structure

**GET /services/env-file/my-api:**

```json
{
  "status": "success",
  "env": "PORT=3000\nDATABASE_URL=mongodb://localhost:27017\n",
  "envStatus": true,
  "envLocal": null,
  "envLocalStatus": false,
  "workingDirectory": "/home/nick/my-api"
}
```

**POST /services/env-file/my-api:**

Request:

```json
{
  "env": "PORT=3000\nDATABASE_URL=mongodb://localhost:27017\n",
  "envLocal": "NODE_ENV=production\nDEBUG=true\n"
}
```

Response:

```json
{
  "status": "success",
  "message": "Env file(s) updated successfully",
  "envWritten": true,
  "envLocalWritten": true,
  "workingDirectory": "/home/nick/my-api"
}
```

### Environment File Precedence

Most Node.js applications load environment files in this order (higher priority last):

1. `.env` - Base configuration, committed to git
2. `.env.local` - Local overrides, gitignored
3. Process environment variables - Highest priority

The Server Manager API returns both files, allowing the frontend to manage each independently based on the application's environment strategy.

---

## Best Practices

### Adding New Services

1. **Generate service file:** Use POST `/services/make-service-file` to create `.service` and `.timer` files
2. **Update CSV:** Add 6 systemctl permission rows to `nick-systemctl.csv`
3. **Apply permissions:** Run `/home/nick/update-nick-systemctl.sh`
4. **Update database:** Add service to machine's `servicesArray` in MongoDB
5. **Enable and start:** Use POST `/services/[filename]/enable` and `/services/[filename]/start`

### Security Considerations

- Never use `ALL` in sudoers rules (e.g., `nick ALL=(ALL) NOPASSWD: ALL` is dangerous)
- Always specify full command paths (`/usr/bin/systemctl`, not `systemctl`)
- Use wildcards sparingly and only for low-risk operations
- Review CSV changes before running update script
- The script validates syntax automatically, preventing broken sudo configurations
- Limit service control permissions to only services managed by The Server Manager

### Troubleshooting

**"sudo: a password is required"**

- Command doesn't match sudoers rule exactly
- Check logs for the exact command being executed
- Verify CSV entry matches command syntax (including destination path format)

**"Permission denied" when writing service files**

- Ensure `/home/nick/` directory is writable by nick user
- Verify sudoers includes mv permissions with wildcard patterns

**Service control fails**

- Verify service has entries in `nick-systemctl.csv` for the specific action
- Run `sudo visudo -c -f /etc/sudoers.d/nick-systemctl` to check for syntax errors
- Ensure service exists in machine's `servicesArray` in MongoDB
