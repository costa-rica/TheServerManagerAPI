import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomUUID } from "crypto";
import { NginxFile } from "../nginxFile";
import { Machine } from "../machine";

describe("NginxFile Model", () => {
	let mongoServer: MongoMemoryServer;
	let appMachinePublicId: string;
	let nginxMachinePublicId: string;

	beforeAll(async () => {
		// Create in-memory MongoDB instance
		mongoServer = await MongoMemoryServer.create();
		const uri = mongoServer.getUri();

		await mongoose.connect(uri);

		// Generate publicIds for test machines
		appMachinePublicId = randomUUID();
		nginxMachinePublicId = randomUUID();

		// Create test machines
		const appMachine = await Machine.create({
			publicId: appMachinePublicId,
			machineName: "test-app-machine",
			urlFor404Api: "http://localhost:3001",
			localIpAddress: "192.168.1.100",
		});

		const nginxMachine = await Machine.create({
			publicId: nginxMachinePublicId,
			machineName: "test-nginx-machine",
			urlFor404Api: "http://localhost:3002",
			localIpAddress: "192.168.1.101",
			nginxStoragePathOptions: ["/etc/nginx/sites-available"],
		});
	});

	afterAll(async () => {
		// Clean up test data
		await NginxFile.deleteMany({});
		await Machine.deleteMany({});
		await mongoose.connection.close();
		await mongoServer.stop();
	});

	afterEach(async () => {
		// Clean up nginx files after each test
		await NginxFile.deleteMany({});
	});

	test("should create a NginxFile document with all required fields", async () => {
		const nginxFile = await NginxFile.create({
			publicId: randomUUID(),
			serverName: "example.com",
			portNumber: 3000,
			serverNameArrayOfAdditionalServerNames: ["www.example.com", "api.example.com"],
			appHostServerMachinePublicId: appMachinePublicId,
			nginxHostServerMachinePublicId: nginxMachinePublicId,
			framework: "ExpressJS",
			storeDirectory: "/etc/nginx/sites-available",
		});

		expect(nginxFile).toBeDefined();
		expect(nginxFile.publicId).toBeDefined();
		expect(nginxFile.serverName).toBe("example.com");
		expect(nginxFile.portNumber).toBe(3000);
		expect(nginxFile.serverNameArrayOfAdditionalServerNames).toHaveLength(2);
		expect(nginxFile.appHostServerMachinePublicId).toBe(appMachinePublicId);
		expect(nginxFile.nginxHostServerMachinePublicId).toBe(nginxMachinePublicId);
		expect(nginxFile.framework).toBe("ExpressJS");
		expect(nginxFile.storeDirectory).toBe("/etc/nginx/sites-available");
		expect(nginxFile.createdAt).toBeDefined();
		expect(nginxFile.updatedAt).toBeDefined();
	});

	test("should verify relationships with Machine collection work correctly using publicId", async () => {
		const nginxFile = await NginxFile.create({
			publicId: randomUUID(),
			serverName: "test.com",
			portNumber: 8080,
			appHostServerMachinePublicId: appMachinePublicId,
			nginxHostServerMachinePublicId: nginxMachinePublicId,
		});

		// Look up machines using publicId references
		const appMachine = await Machine.findOne({ publicId: nginxFile.appHostServerMachinePublicId });
		const nginxMachine = await Machine.findOne({ publicId: nginxFile.nginxHostServerMachinePublicId });

		expect(appMachine).toBeDefined();
		expect(appMachine!.machineName).toBe("test-app-machine");
		expect(nginxMachine).toBeDefined();
		expect(nginxMachine!.machineName).toBe("test-nginx-machine");
	});

	test("should fail validation when required fields are missing", async () => {
		// Test missing publicId
		await expect(
			NginxFile.create({
				serverName: "example.com",
				portNumber: 3000,
				appHostServerMachinePublicId: appMachinePublicId,
				nginxHostServerMachinePublicId: nginxMachinePublicId,
			})
		).rejects.toThrow();

		// Test missing serverName
		await expect(
			NginxFile.create({
				publicId: randomUUID(),
				portNumber: 3000,
				appHostServerMachinePublicId: appMachinePublicId,
				nginxHostServerMachinePublicId: nginxMachinePublicId,
			})
		).rejects.toThrow();

		// Test missing portNumber
		await expect(
			NginxFile.create({
				publicId: randomUUID(),
				serverName: "example.com",
				appHostServerMachinePublicId: appMachinePublicId,
				nginxHostServerMachinePublicId: nginxMachinePublicId,
			})
		).rejects.toThrow();

		// Test missing appHostServerMachinePublicId
		await expect(
			NginxFile.create({
				publicId: randomUUID(),
				serverName: "example.com",
				portNumber: 3000,
				nginxHostServerMachinePublicId: nginxMachinePublicId,
			})
		).rejects.toThrow();

		// Test missing nginxHostServerMachinePublicId
		await expect(
			NginxFile.create({
				publicId: randomUUID(),
				serverName: "example.com",
				portNumber: 3000,
				appHostServerMachinePublicId: appMachinePublicId,
			})
		).rejects.toThrow();
	});

	test("should allow optional fields to be omitted", async () => {
		const nginxFile = await NginxFile.create({
			publicId: randomUUID(),
			serverName: "minimal.com",
			portNumber: 5000,
			appHostServerMachinePublicId: appMachinePublicId,
			nginxHostServerMachinePublicId: nginxMachinePublicId,
		});

		expect(nginxFile).toBeDefined();
		expect(nginxFile.framework).toBeUndefined();
		expect(nginxFile.storeDirectory).toBeUndefined();
		expect(nginxFile.serverNameArrayOfAdditionalServerNames).toHaveLength(0);
	});

	test("should allow same machine to be both app and nginx host", async () => {
		const nginxFile = await NginxFile.create({
			publicId: randomUUID(),
			serverName: "localhost.com",
			portNumber: 3000,
			appHostServerMachinePublicId: appMachinePublicId,
			nginxHostServerMachinePublicId: appMachinePublicId, // Same machine for both
		});

		expect(nginxFile).toBeDefined();
		expect(nginxFile.appHostServerMachinePublicId).toBe(nginxFile.nginxHostServerMachinePublicId);
	});
});
