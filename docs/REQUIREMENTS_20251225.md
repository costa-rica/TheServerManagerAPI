# The Server Manager API Requirements

These requirements are created withe goal of adding management of services that run on Ubuntu servers. The services will be .service files in the /etc/systemd/system/ directories.

To accomplish this will weill implement a services router and module files.

## Database

The database will now use publicId. Each collection schema in the MongoDb will have a publicId. This will be used in place of sending document ids.

## Machine Router

This section contains the details by endpoint from the machines router that need to be modified.

### POST /machines

The POST /machines endpoint needs to be modified so the user can input the services that will run on the server. The services inputs will need to be all optional.

There will be a servicesArray passed in the body of the request. Each element in the array will have name, filename, and pathToLogs that are required and both strings. Then optionally, there will be a filenameTimer (string) and port (Number).

### PATCH /machine/{publicId}

This will allow for updating the machines collection properties. We can enter nginxStoragePathOptions (array) , pathToLogs, urlFor404Api, localIpAddress, and servicesArray. The machineName will not be updatable.

## Services Router

Each subsection is headed by and endpoint name. Each sub section will contain the requirements for the new endpoint.

When the “NODE_ENV=production” .env variable is not set to “production”, the app will not be running on a Ubuntu server so endpoints interacting with the Ubuntu OS will need to return a corresponding response.

### GET /

This endpoint will return the array of the services running on the server. It will return an array called servicesStatusArray. The endpoint will interact with the Ubuntu OS to determine various status elements for each application.
servicesStatusArray:[
{name: string, filename: string, status: string, timerStatus: string (optional), timerTrigger: string (optional)}]

In each element the name and filename will come from the machine’s servicesArray. This API will run on a machine and the machine name can be determined by calling the getMachineInfo() function from the modules/machines.ts file. Using the name response of this function will allow the endpoint to search the machines collection in the MongoDb database and search for the corresponding document’s servicesArray.

The status, timerStatus, and timerTrigger will come from functions in called by the endpoint. I want this endpoint to be heavily modularized, using functions that will be in the corresponding services.ts file, so it is easy to follow.

To populate the status subelement we’ll use the “Active” response from the Ubuntu OS terminal command “sudo systemctl status {serviceArray.filename}”.

Here is an example

```bash
➜  ~ sudo systemctl status personalweb03-services.service
○ personalweb03-services.service - PersonalWeb03 Services Job
     Loaded: loaded (/etc/systemd/system/personalweb03-services.service; static)
     Active: inactive (dead) since Thu 2025-12-25 19:19:14 UTC; 5min ago
TriggeredBy: ● personalweb03-services.timer
   Main PID: 7642 (code=exited, status=0/SUCCESS)
        CPU: 2.117s
```

WE should make at least one function in the modules/services.ts file that will handle this. If multiple functions are necessary to follow best practices for this functionality, please create more.

To populate the timerStatus, we will look in the servicesArray element for the filenameTimer subelement. If this is not null this means the service uses a timer and we want to collect the timer’s status and the timerTrigger. We should make another function (at least one) in the modules/services.ts file that will interact with the OS using the “sudo systemctl status {filenameTimer}” command.

The OS response to this will contain an “Active” and a “Trigger” response. These will be placed in the corresponding element’s timerStatus and timerTrigger values.

Here is an example of making the timer request:

```bash
➜  ~ sudo systemctl status personalweb03-services.timer
● personalweb03-services.timer - PersonalWeb03 Services Timer
     Loaded: loaded (/etc/systemd/system/personalweb03-services.timer; disabled; preset: enabled)
     Active: active (waiting) since Thu 2025-12-25 19:19:04 UTC; 4min 40s ago
    Trigger: Thu 2025-12-25 23:00:00 UTC; 3h 36min left
   Triggers: ● personalweb03-services.service
```

### POST /{serviceFilename}/{toggleStatus}

This endpoint will be responsible for turning on and off the service in the params of the request. This endpoint will make the Ubuntu OS commands “sudo systemctl start personalweb03-api.service” or “sudo systemctl stop personalweb03-api.service”.

Therefore the serviceFilename will include the filename of the service which will be “personalweb03-api.service” in the example above. Then the toggleStatus will be “start” or “stop”.

The response will be a service element that looks like. This will include the name, which is the name of the application
{name: string, filename: string, status: string, timerStatus: string (optional), timerTrigger: string (optional)}]

### GET /logs/{name}

This endpoint will send the logs for the corresponding service. In the corresponding machine document for this server there is a pathToLogs property that will have the path on the server that log files can be found. The log files will have the form {name}.log, where name comes from the name params.

The endpoint should return the log requested.
