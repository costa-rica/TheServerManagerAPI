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

## Routers

- [/machines](./api/machines.md) : Machine management
- [/users](./api/users.md) : User management
- [/nginx](./api/nginx.md) : Nginx management
- [/registrar](./api/registrar.md) : Registrar management
