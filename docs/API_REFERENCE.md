# API Reference - The Server Manager API

This document provides comprehensive documentation for API endpoints in the The Server Manager API service.

## Documentation Standards

All endpoint documentation should follow this concise structure:

### Required Sections

1. **Endpoint Heading** - HTTP method and path (e.g., `## GET /machines`)
2. **Brief Description** - One sentence describing what the endpoint does
3. **Authentication** - `**Authentication:** Required (JWT token)` or `Not required`
4. **Sample Request** - curl example showing typical usage with headers and body
5. **Response Examples** - Success response (200) and relevant error responses (400, 404, 500)
6. **Behavior** (optional) - Key points about how the endpoint works, special logic, or important notes

### Optional Sections

- **Request Body Fields** - Table of parameters (if complex)
- **Response Fields** - Description of response structure (if complex)
- **URL Parameters** - For parameterized routes

### Format Guidelines

- Keep descriptions **concise** - avoid verbose explanations
- Use **code blocks** for all JSON examples
- Include **realistic data** in examples
- Use **tables** for parameter lists
- Keep **bullet points brief** in Behavior sections

### Anti-patterns to Avoid

- ❌ Long prose explanations
- ❌ Multiple redundant examples
- ❌ Excessive "Important Notes" sections
- ❌ Verbose field descriptions
- ❌ Integration code examples (unless truly necessary)

### Error Response Format

All API errors should return a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE_HERE",
    "message": "User-facing error message",
    "details": "Additional context (optional)",
    "status": 500
  }
}
```

**Field Definitions:**

- `code` - Machine-readable identifier (uppercase with underscores, e.g., `MACHINE_NOT_FOUND`, `VALIDATION_ERROR`)
- `message` - Human-readable summary for users (concise and clear)
- `details` - Optional additional context (include in development, sanitize in production)
- `status` - HTTP status code matching the response header

**Express.js Implementation:**

```typescript
// Single error
res.status(404).json({
  error: {
    code: "MACHINE_NOT_FOUND",
    message: "Machine not found",
    details: process.env.NODE_ENV === "development" ? error.message : undefined,
    status: 404,
  },
});

// Validation errors
res.status(400).json({
  error: {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    status: 400,
    details: [
      { field: "email", message: "Invalid email format" },
      { field: "port", message: "Must be a number" },
    ],
  },
});
```

**Common Error Codes:**

- `VALIDATION_ERROR` - Invalid request data (400)
- `AUTH_FAILED` - Authentication failure (401)
- `FORBIDDEN` - Insufficient permissions (403)
- `NOT_FOUND` - Resource doesn't exist (404)
- `INTERNAL_ERROR` - Server error (500)

**Security Guidelines:**

- Never expose in production: stack traces, database errors, file paths, internal system details
- Always include HTTP status in both response header and error body
- Log detailed errors server-side, return sanitized versions to clients

## Routers

- [/users](./api/users.md) : User authentication and management
- [/machines](./api/machines.md) : Machine management with permission filtering
- [/admin](./api/admin.md) : Admin user management and access control
- [/nginx](./api/nginx.md) : Nginx configuration management
- [/registrar](./api/registrar.md) : DNS registrar management
