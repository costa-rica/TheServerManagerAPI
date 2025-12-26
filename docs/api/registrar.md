# Registrar Routes

DNS management endpoints integrating with Porkbun API v3 for domain and subdomain operations.

**Note:** All endpoints require JWT authentication and Porkbun API credentials configured in environment variables.

**Required Environment Variables:**
- `PORKBUN_API_KEY`
- `PORKBUN_SECRET_KEY`

---

## GET /registrar/get-all-porkbun-domains

Fetch all domains registered in your Porkbun account.

**Authentication:** Required (JWT token)

**Sample Request:**

```bash
curl --location 'http://localhost:3000/registrar/get-all-porkbun-domains' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "domainsArray": [
    {
      "domain": "example.com",
      "status": "ACTIVE"
    },
    {
      "domain": "mysite.org",
      "status": "ACTIVE"
    }
  ]
}
```

**Error Response (500 Internal Server Error - Missing Credentials):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Porkbun API credentials not configured"
}
```

**Error Response (500 Internal Server Error - Porkbun Error):**

```json
{
  "errorFrom": "porkbun",
  "error": "Invalid API key or secret"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Internal server error"
}
```

**Behavior:**

- Calls Porkbun API endpoint: `https://api.porkbun.com/api/json/v3/domain/listAll`
- Returns simplified array with only `domain` and `status` fields
- Error responses include `errorFrom` field to distinguish between Porkbun and server errors

---

## POST /registrar/create-subdomain

Create a new DNS subdomain record (A or CNAME) on Porkbun.

**Authentication:** Required (JWT token)

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | String | Yes | Root domain (e.g., "example.com") |
| `subdomain` | String | Yes | Subdomain name (e.g., "api" for api.example.com) |
| `publicIpAddress` | String | Yes | IP address or target for the DNS record |
| `type` | String | Yes | DNS record type (e.g., "A", "CNAME") |

**Sample Request:**

```bash
curl --location 'http://localhost:3000/registrar/create-subdomain' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "domain": "example.com",
  "subdomain": "api",
  "publicIpAddress": "203.0.113.100",
  "type": "A"
}'
```

**Success Response (201 Created):**

```json
{
  "message": "Subdomain created successfully",
  "recordId": "123456789",
  "domain": "example.com",
  "subdomain": "api",
  "type": "A",
  "publicIpAddress": "203.0.113.100",
  "ttl": 600
}
```

**Error Response (400 Bad Request - Missing Fields):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Missing domain, subdomain, publicIpAddress, type"
}
```

**Error Response (500 Internal Server Error - Missing Credentials):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Porkbun API credentials not configured"
}
```

**Error Response (500 Internal Server Error - Porkbun Error):**

```json
{
  "errorFrom": "porkbun",
  "error": "The subdomain already exists for this domain"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Internal server error"
}
```

**Behavior:**

- Calls Porkbun API endpoint: `https://api.porkbun.com/api/json/v3/dns/create/{domain}`
- Sets TTL to 600 seconds (10 minutes) by default
- Returns Porkbun-generated `recordId` for future reference
- Common DNS record types: "A" (IPv4), "AAAA" (IPv6), "CNAME" (alias), "MX" (mail)

---

## GET /registrar/get-all-porkbun-subdomains/:domain

Retrieve all DNS records for a specific domain from Porkbun.

**Authentication:** Required (JWT token)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | String | Yes | Domain to retrieve DNS records for |

**Sample Request:**

```bash
curl --location 'http://localhost:3000/registrar/get-all-porkbun-subdomains/example.com' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Success Response (200 OK):**

```json
{
  "subdomainsArray": [
    {
      "name": "api.example.com",
      "type": "A",
      "content": "203.0.113.100"
    },
    {
      "name": "www.example.com",
      "type": "CNAME",
      "content": "example.com"
    },
    {
      "name": "example.com",
      "type": "A",
      "content": "203.0.113.50"
    }
  ]
}
```

**Error Response (400 Bad Request - Missing Domain):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Domain parameter is required"
}
```

**Error Response (500 Internal Server Error - Missing Credentials):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Porkbun API credentials not configured"
}
```

**Error Response (500 Internal Server Error - Porkbun Error):**

```json
{
  "errorFrom": "porkbun",
  "error": "Domain not found in your account"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Internal server error"
}
```

**Behavior:**

- Calls Porkbun API endpoint: `https://api.porkbun.com/api/json/v3/dns/retrieve/{domain}`
- Returns simplified array with only `name`, `type`, and `content` fields
- Includes all DNS record types (A, AAAA, CNAME, MX, TXT, etc.)
- Includes root domain records and all subdomains

---

## DELETE /registrar/porkbun-subdomain

Delete a DNS subdomain record from Porkbun by name and type.

**Authentication:** Required (JWT token)

**Request Body Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | String | Yes | Root domain (e.g., "example.com") |
| `type` | String | Yes | DNS record type (e.g., "A", "CNAME") |
| `subdomain` | String | Yes | Subdomain name (e.g., "api") |

**Sample Request:**

```bash
curl --location --request DELETE 'http://localhost:3000/registrar/porkbun-subdomain' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data-raw '{
  "domain": "example.com",
  "type": "A",
  "subdomain": "api"
}'
```

**Success Response (200 OK):**

```json
{
  "message": "DNS record deleted successfully",
  "domain": "example.com",
  "type": "A",
  "subdomain": "api"
}
```

**Error Response (400 Bad Request - Missing Fields):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Missing domain, type, subdomain"
}
```

**Error Response (500 Internal Server Error - Missing Credentials):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Porkbun API credentials not configured"
}
```

**Error Response (500 Internal Server Error - Porkbun Error):**

```json
{
  "errorFrom": "porkbun",
  "error": "DNS record not found"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "errorFrom": "The Server Manager",
  "error": "Internal server error"
}
```

**Behavior:**

- Calls Porkbun API endpoint: `https://api.porkbun.com/api/json/v3/dns/deleteByNameType/{domain}/{type}/{subdomain}`
- Deletes all DNS records matching the exact name and type combination
- If multiple records exist with same name and type, all are deleted
- Use exact subdomain name without the domain (e.g., "api" not "api.example.com")
