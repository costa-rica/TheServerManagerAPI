# The Server Manager API

The Server Manager API is an ExpressJS TypeScript application that provides a RESTful API for managing servers and their applications. Each Ubuntu server runs its own instance of this API, all secured by a shared authentication layer and unified MongoDB instance.

## The Server Manager Ecosystem

The Server Manager project is designed to help monitor, manage, and orchestrate servers and their applications across Ubuntu servers. It connects to various APIs deployed on each machine, all secured by a shared authentication layer and unified MongoDB instance.

There will be a front facing Next.js web application that provides real-time visibility and management features for your servers. Through its interface, users can:

- View process logs from any connected machine. Logs found in machine collection in MongoDB, the document called pathToLogs to the corresponding server's (machine) document.
- Check the status of apps running on the server. These apps Python and node.js applications that run using .service files
- Manage DNS entries via the Porkbun API to add or modify Type A subdomains.
- Automatically generate and register Nginx configurations for new subdomains.
- View and manage existing Nginx configuration files from each server’s `/etc/nginx/sites-available/`, `/etc/nginx/sites-enabled/` directories - these paths are found in the machine collection in MongoDB, the document called nginxStoragePathOptions to the corresponding server's (machine) document.

The dashboard unifies multiple APIs, each hosted on a separate Ubuntu server, and communicates securely with the shared MongoDB database that stores machine data and network configurations. By switching between connected machines, The Server Manager dynamically updates its data context to display logs, apps, and configurations for the selected server.

## .env

### workstation

```
NAME_APP=TheServerManagerAPI
PORT=3000
JWT_SECRET=SECRET_KEY
ADMIN_EMAIL=["nrodrig1@gmail.com"]
PROJECT_RESOURCES=/Users/nick/Documents/_project_resources/TheServerManagerAPI
MONGODB_URI=mongodb+srv://nrodrig1:SECRET_KEY@cluster0.8puct.mongodb.net/TheServerManagerAPI
ADMIN_NODEMAILER_EMAIL_ADDRESS="nrodrig1@gmail.com"
ADMIN_NODEMAILER_EMAIL_PASSWORD="SECRET_KEY"
URL_THE_SERVER_MANAGER_WEB=https://the-server-manager.dashanddata.com/
PORKBUN_API_KEY=SECRET_KEY
PORKBUN_SECRET_KEY=SECRET_KEY
PATH_PROJECT_RESOURCES=/Users/nick/Documents/_project_resources/TheServerManagerAPI
PATH_ETC_NGINX_SITES_AVAILABLE=/Users/nick/Documents/_testData/nginx/sites-available
PATH_TO_LOGS=/Users/nick/Documents/_testData/logs
```

## Run tests

```bash
npm test -- src/models/__tests__/nginxFile.test.ts
```
