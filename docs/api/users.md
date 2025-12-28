# User Routes

User authentication and management endpoints for registration, login, and password reset.

---

## GET /users

Simple endpoint returning a status message.

**Authentication:** Not required

**Sample Request:**

```bash
curl --location 'http://localhost:3000/users'
```

**Success Response (200 OK):**

```
users endpoint
```

---

## POST /users/register

Register a new user account.

**Authentication:** Not required

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | String | Yes | User email address (used for login) |
| `password` | String | Yes | User password (will be hashed with bcrypt) |

**Sample Request:**

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

**Error Response (400 Bad Request - Missing Fields):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing required fields: email, password",
    "status": 400
  }
}
```

**Error Response (409 Conflict - User Exists):**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "User already exists",
    "details": "A user with this email address is already registered",
    "status": 409
  }
}
```

**Behavior:**

- Auto-generates `username` from email (part before @)
- Auto-generates `publicId` using crypto.randomUUID()
- Hashes password with bcrypt (salt rounds: 10)
- Returns JWT token signed with `JWT_SECRET` environment variable
- Sets `isAdmin` to false by default

---

## POST /users/login

Authenticate and log in an existing user.

**Authentication:** Not required

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | String | Yes | User email address |
| `password` | String | Yes | User password |

**Sample Request:**

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

**Error Response (400 Bad Request - Missing Fields):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing required fields: email, password",
    "status": 400
  }
}
```

**Error Response (401 Unauthorized - Invalid Credentials):**

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid credentials",
    "status": 401
  }
}
```

**Behavior:**

- Verifies password using bcrypt.compare()
- Returns JWT token signed with `JWT_SECRET` environment variable
- Includes `isAdmin` flag in user response for authorization checks

---

## POST /users/request-reset-password-email

Request a password reset email with a JWT token that expires in 1 hour.

**Authentication:** Not required

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | String | Yes | User email address |

**Sample Request:**

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

**Error Response (400 Bad Request - Missing Email):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Email is required",
    "status": 400
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

**Behavior:**

- Generates JWT token with 1 hour expiration
- Sends email using `sendResetPasswordEmail()` function from mailer module
- Returns success response even if email delivery fails (check server logs for email errors)
- Token contains user ID and is signed with `JWT_SECRET`

---

## POST /users/reset-password-with-new-password

Reset user password using the token from the reset email.

**Authentication:** Not required (uses JWT token from email)

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | String | Yes | JWT token from reset password email |
| `newPassword` | String | Yes | New password to set |

**Sample Request:**

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

**Error Response (400 Bad Request - Missing Fields):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": "Missing required fields: token, newPassword",
    "status": 400
  }
}
```

**Error Response (401 Unauthorized - Invalid Token):**

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid or expired token",
    "status": 401
  }
}
```

**Error Response (401 Unauthorized - Expired Token):**

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Reset token has expired",
    "status": 401
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
    "message": "Failed to reset password",
    "details": "Detailed error message (only in development mode)",
    "status": 500
  }
}
```

**Behavior:**

- Verifies JWT token signature and expiration (1 hour from issuance)
- Extracts user ID from decoded token
- Hashes new password with bcrypt (salt rounds: 10)
- Updates user's password in database
- Token can only be used once (no token invalidation tracking)
