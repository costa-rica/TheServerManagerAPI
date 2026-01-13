# Tiered Permissions

We want to implement a tiered permission system for the API. The permissions will be to have admin users which can do anything, and standard (i.e. isAdmin=false) users which can only do certain things.

There are two limitations we aim to implement:

1. Non-admin users willl be restricted to which servers they can access.
2. Non-admin users will be restricted to which pages in the NextJS frontend they can access.

## Backend / Database

The users collection will have an `isAdmin` boolean field, and a `accessServersArray` array field, and a `accessPagesArray` array field. The accessServersArray will contain the machine publicIds of the servers the user can access, and the accessPagesArray will contain the pages the user can access.

### accessPagesArray

The accessPagesArray could contain:

- '/servers/services'
- '/dns/nginx'
- '/dns/registrar'

## Backend / API

### Login

On login the API will send the user's accessServersArray and accessPagesArray to the frontend.

### GET /machines

The API GET /machines will return all machines if the user is an admin, and only the machines whose publicIds are in the accessServersArray if the user is not an admin.

### Frontend Team Recommended: GET /admin/users

Returns all users with their permission details for the admin page table.

Request:

```
GET /admin/users
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "users": [
    {
      "publicId": "user123",
      "email": "user@example.com",
      "username": "user",
      "isAdmin": false,
      "accessServersArray": [
        "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
        "b4g3c2d5-6e7f-8g9a-0c1d-2e3f4a5b6c7d"
      ],
      "accessPagesArray": ["/dns/nginx", "/servers/services"]
    }
  ]
}
```

### Frontend Team Recommended: PATCH /admin/user/:userId/access-servers

Updates a user's accessServersArray. Replaces the entire array with the new values.

Request:

```
PATCH /admin/user/user123/access-servers
Authorization: Bearer <token>
Content-Type: application/json

{
  "accessServersArray": ["a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c", "c5h4d3e6-7f8g-9h0b-1d2e-3f4g5h6i7j8k"]
}
```

Response:

```json
{
  "success": true,
  "message": "Server access updated",
  "user": {
    "publicId": "user123",
    "email": "user@example.com",
    "accessServersArray": [
      "a3f2b1c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
      "c5h4d3e6-7f8g-9h0b-1d2e-3f4g5h6i7j8k"
    ]
  }
}
```

### Frontend Team Recommended: PATCH /admin/user/:userId/access-pages

Updates a user's accessPagesArray. Replaces the entire array with the new values.

Request:

```
PATCH /admin/user/user123/access-pages
Authorization: Bearer <token>
Content-Type: application/json

{
  "accessPagesArray": ["/dns/nginx", "/dns/registrar", "/servers/services"]
}
```

Response:

```json
{
  "success": true,
  "message": "Page access updated",
  "user": {
    "publicId": "user123",
    "email": "user@example.com",
    "accessPagesArray": ["/dns/nginx", "/dns/registrar", "/servers/services"]
  }
}
```

## Frontend

When a user logs in the frontend will receive the user's accessServersArray and accessPagesArray from the API and store them in the userSlice. The userSlice will need to be modified to store these arrays.

The AppSidebar will need to be modified to only show the pages in the accessPagesArray.

If a user types the url of a page they are not allowed to access, they will be redirected to /unauthorized.

### Using accessPagesArray

The accessPagesArray stores only permission-controlled pages. Do NOT include public pages or default pages in the database.

Permission logic:

- Admin users (isAdmin=true) bypass all permission checks and see all pages
- Non-admin users must have the page path in accessPagesArray to access it
- Page matching uses exact path with startsWith() for nested routes

### Default Pages

Default pages are accessible to all authenticated users and defined in code, not stored in the database.

Default accessible pages:

- /home
- /servers/machines (accessible to all users as the primary landing page)

Benefits of defining in code:

- No database bloat from repeating defaults for every user
- Simpler user administration
- Single place to maintain defaults

Implementation:

- Create DEFAULT_ACCESSIBLE_PAGES constant in src/utils/permissions.ts
- Permission checks combine DEFAULT_ACCESSIBLE_PAGES + accessPagesArray
- Sidebar filtering includes defaults automatically

### Permission Check Logic

Create a centralized utility function for permission checking:

```typescript
function hasPageAccess(pathname, isAdmin, accessPagesArray) {
  if (isAdmin) return true;
  if (DEFAULT_ACCESSIBLE_PAGES.some((page) => pathname.startsWith(page)))
    return true;
  return accessPagesArray.some((page) => pathname.startsWith(page));
}
```

Used in:

- Dashboard layout for route protection (redirect unauthorized access)
- AppSidebar for filtering navigation items

### Frontend Implementation TODO

#### Phase 1: State Management

1. Update userSlice (src/store/features/user/userSlice.ts)

   - Add accessServersArray: string[] field to UserState
   - Add accessPagesArray: string[] field to UserState
   - Update loginUser action to store both arrays
   - Update logoutUserFully to clear both arrays

2. Update LoginForm (src/components/auth/LoginForm.tsx)
   - Dispatch accessServersArray and accessPagesArray from login response
   - Change redirect logic to use first accessible page (not hardcoded /servers/machines)

API Requirements:

- Login endpoint must return accessServersArray and accessPagesArray
- Response format: { token, user: { username, email, isAdmin, accessServersArray, accessPagesArray } }

#### Phase 2: Route Protection

1. Create /unauthorized page (src/app/(full-width)/unauthorized/page.tsx)

   - Display access denied message
   - Button to return to home or first accessible page
   - Use full-width layout

2. Create permissions utility (src/utils/permissions.ts)

   - Define DEFAULT_ACCESSIBLE_PAGES constant
   - Create hasPageAccess() function
   - Export for reuse

3. Update dashboard layout (src/app/(dashboard)/layout.tsx)
   - Add useEffect to check permissions on pathname change
   - Redirect to /unauthorized if hasPageAccess returns false
   - Skip check for public routes

#### Phase 3: Sidebar Filtering

1. Update AppSidebar (src/layout/AppSidebar.tsx)
   - Import hasPageAccess utility
   - Filter navItems array based on permissions
   - Filter subItems for parent menus
   - Hide parent menu if all subItems filtered
   - Always show non-route items (Logout, Theme toggle)

#### Phase 4: Edge Cases

1. Zero permissions handling

   - User with empty accessPagesArray only sees defaults
   - Handle empty sidebar gracefully

2. First login redirect

   - If accessPagesArray empty, redirect to /home or /unauthorized
   - If has permissions, redirect to first page in accessPagesArray

3. Test scenarios
   - Admin sees everything
   - Non-admin with partial permissions sees filtered sidebar
   - Direct URL access redirects properly
   - Browser back button doesn't bypass protection

### Admin Page

The /admin page is accessible only to isAdmin=true users for managing user permissions.

Components:

1. TableAdminUserPrivileges

   - Displays all users in a table
   - Columns: email, isAdmin, servers (accessServersArray), pages (accessPagesArray)
   - isAdmin column displays boolean value (read-only)
   - servers column shows list of accessible machine names (lookup from publicIds) + edit icon button
   - pages column shows list of accessible page paths + edit icon button
   - Edit icons positioned to the right of each list

2. ModalAdminEditServers

   - Opens when servers edit icon clicked
   - Top section: displays user's current server access (machine names)
   - Bottom section: list of all available servers (from GET /machines) with checkboxes
   - Display machine names but store/submit publicIds
   - Checkboxes allow adding/removing server access
   - Submit button at bottom to save changes

3. ModalAdminEditPages
   - Opens when pages edit icon clicked
   - Top section: displays user's current page access
   - Bottom section: list of all available permission-controlled pages with checkboxes
   - Available pages defined as hardcoded constant in frontend
   - Checkboxes allow adding/removing page access
   - Submit button at bottom to save changes

Implementation notes:

- Use GET /machines to populate server list in ModalAdminEditServers
- Define PERMISSION_CONTROLLED_PAGES constant for ModalAdminEditPages options
- Modal submit calls respective PATCH endpoints to update user permissions
- Update machineSlice to store publicId field (currently only stores \_id)
- Display machine names in UI but use publicIds for access control
