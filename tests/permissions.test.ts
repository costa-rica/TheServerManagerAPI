/**
 * Integration Tests for Tiered Permissions System
 *
 * These tests verify the permission system including:
 * - User model schema with accessServersArray and accessPagesArray
 * - Login/register endpoints returning permission arrays
 * - GET /machines filtering based on user permissions
 * - Admin-only user management endpoints
 */

import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { User } from "../src/models/user";
import { Machine } from "../src/models/machine";
import app from "../src/app";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

let mongoServer: MongoMemoryServer;
let adminToken: string;
let nonAdminToken: string;
let adminUserId: string;
let nonAdminUserId: string;
let machine1Id: string;
let machine2Id: string;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test machines
  const machine1 = await Machine.create({
    publicId: randomUUID(),
    machineName: "test-machine-1",
    urlApiForTsmNetwork: "http://localhost:3001",
    localIpAddress: "192.168.1.100",
    nginxStoragePathOptions: ["/etc/nginx/sites-available"],
    servicesArray: [],
  });
  machine1Id = machine1.publicId;

  const machine2 = await Machine.create({
    publicId: randomUUID(),
    machineName: "test-machine-2",
    urlApiForTsmNetwork: "http://localhost:3002",
    localIpAddress: "192.168.1.101",
    nginxStoragePathOptions: ["/etc/nginx/sites-available"],
    servicesArray: [],
  });
  machine2Id = machine2.publicId;

  // Create admin user
  const adminUser = await User.create({
    publicId: randomUUID(),
    email: "admin@test.com",
    username: "admin",
    password: await bcrypt.hash("password123", 10),
    isAdmin: true,
    accessServersArray: [],
    accessPagesArray: [],
  });
  adminUserId = adminUser.publicId;
  adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET || "test-secret");

  // Create non-admin user with limited permissions
  const nonAdminUser = await User.create({
    publicId: randomUUID(),
    email: "user@test.com",
    username: "user",
    password: await bcrypt.hash("password123", 10),
    isAdmin: false,
    accessServersArray: [machine1Id], // Only has access to machine1
    accessPagesArray: ["/dns/nginx", "/servers/services"],
  });
  nonAdminUserId = nonAdminUser.publicId;
  nonAdminToken = jwt.sign({ id: nonAdminUser._id }, process.env.JWT_SECRET || "test-secret");
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("User Model Schema", () => {
  it("should have accessServersArray and accessPagesArray fields with default empty arrays", async () => {
    const user = await User.create({
      publicId: randomUUID(),
      email: "newuser@test.com",
      username: "newuser",
      password: await bcrypt.hash("password123", 10),
    });

    expect(user.accessServersArray).toEqual([]);
    expect(user.accessPagesArray).toEqual([]);
    expect(user.isAdmin).toBe(false);
  });
});

describe("POST /users/register", () => {
  it("should return accessServersArray and accessPagesArray in response", async () => {
    const response = await request(app)
      .post("/users/register")
      .send({
        email: "register@test.com",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toHaveProperty("accessServersArray");
    expect(response.body.user).toHaveProperty("accessPagesArray");
    expect(response.body.user.accessServersArray).toEqual([]);
    expect(response.body.user.accessPagesArray).toEqual([]);
  });
});

describe("POST /users/login", () => {
  it("should return accessServersArray and accessPagesArray for admin user", async () => {
    const response = await request(app)
      .post("/users/login")
      .send({
        email: "admin@test.com",
        password: "password123",
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toHaveProperty("accessServersArray");
    expect(response.body.user).toHaveProperty("accessPagesArray");
    expect(response.body.user.isAdmin).toBe(true);
  });

  it("should return accessServersArray and accessPagesArray for non-admin user", async () => {
    const response = await request(app)
      .post("/users/login")
      .send({
        email: "user@test.com",
        password: "password123",
      });

    expect(response.status).toBe(200);
    expect(response.body.user.accessServersArray).toEqual([machine1Id]);
    expect(response.body.user.accessPagesArray).toEqual(["/dns/nginx", "/servers/services"]);
    expect(response.body.user.isAdmin).toBe(false);
  });
});

describe("GET /machines - Permission Filtering", () => {
  it("should return all machines for admin user", async () => {
    const response = await request(app)
      .get("/machines")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe(true);
    expect(response.body.existingMachines).toHaveLength(2);
  });

  it("should return only permitted machines for non-admin user", async () => {
    const response = await request(app)
      .get("/machines")
      .set("Authorization", `Bearer ${nonAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe(true);
    expect(response.body.existingMachines).toHaveLength(1);
    expect(response.body.existingMachines[0].publicId).toBe(machine1Id);
  });

  it("should not return MongoDB _id field in machine response", async () => {
    const response = await request(app)
      .get("/machines")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    response.body.existingMachines.forEach((machine: any) => {
      expect(machine).not.toHaveProperty("_id");
      expect(machine).toHaveProperty("publicId");
    });
  });

  it("should return empty array for non-admin user with no server access", async () => {
    // Create user with empty accessServersArray
    const emptyAccessUser = await User.create({
      publicId: randomUUID(),
      email: "noaccess@test.com",
      username: "noaccess",
      password: await bcrypt.hash("password123", 10),
      isAdmin: false,
      accessServersArray: [],
      accessPagesArray: [],
    });
    const emptyAccessToken = jwt.sign(
      { id: emptyAccessUser._id },
      process.env.JWT_SECRET || "test-secret"
    );

    const response = await request(app)
      .get("/machines")
      .set("Authorization", `Bearer ${emptyAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.existingMachines).toHaveLength(0);
  });
});

describe("GET /admin/users - Admin Only", () => {
  it("should return all users for admin", async () => {
    const response = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.users)).toBe(true);
    expect(response.body.users.length).toBeGreaterThan(0);

    // Verify user structure
    const user = response.body.users[0];
    expect(user).toHaveProperty("publicId");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("username");
    expect(user).toHaveProperty("isAdmin");
    expect(user).toHaveProperty("accessServersArray");
    expect(user).toHaveProperty("accessPagesArray");
  });

  it("should deny access for non-admin user", async () => {
    const response = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${nonAdminToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});

describe("PATCH /admin/user/:userId/access-servers - Admin Only", () => {
  it("should update user's accessServersArray for admin", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-servers`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessServersArray: [machine1Id, machine2Id],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.accessServersArray).toEqual([machine1Id, machine2Id]);

    // Verify database was updated
    const updatedUser = await User.findOne({ publicId: nonAdminUserId });
    expect(updatedUser?.accessServersArray).toEqual([machine1Id, machine2Id]);
  });

  it("should reject invalid machine publicIds", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-servers`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessServersArray: ["invalid-machine-id-123"],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toBe("Invalid machine publicIds");
  });

  it("should deny access for non-admin user", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-servers`)
      .set("Authorization", `Bearer ${nonAdminToken}`)
      .send({
        accessServersArray: [machine1Id],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("should return 404 for non-existent user", async () => {
    const response = await request(app)
      .patch(`/admin/user/non-existent-user-id/access-servers`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessServersArray: [machine1Id],
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("should allow empty array to remove all access", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-servers`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessServersArray: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.user.accessServersArray).toEqual([]);
  });
});

describe("PATCH /admin/user/:userId/access-pages - Admin Only", () => {
  it("should update user's accessPagesArray for admin", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-pages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessPagesArray: ["/dns/nginx", "/dns/registrar", "/servers/services"],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.accessPagesArray).toEqual([
      "/dns/nginx",
      "/dns/registrar",
      "/servers/services",
    ]);

    // Verify database was updated
    const updatedUser = await User.findOne({ publicId: nonAdminUserId });
    expect(updatedUser?.accessPagesArray).toEqual([
      "/dns/nginx",
      "/dns/registrar",
      "/servers/services",
    ]);
  });

  it("should reject page paths with spaces", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-pages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessPagesArray: ["/invalid path"],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toBe("Invalid page path");
  });

  it("should reject page paths with invalid characters", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-pages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessPagesArray: ["/path@with#symbols"],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should accept valid page paths", async () => {
    const validPaths = [
      "/dns/nginx",
      "/dns/registrar",
      "/servers/services",
      "/admin/users-management",
      "/some-path.with-dots",
    ];

    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-pages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessPagesArray: validPaths,
      });

    expect(response.status).toBe(200);
    expect(response.body.user.accessPagesArray).toEqual(validPaths);
  });

  it("should deny access for non-admin user", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-pages`)
      .set("Authorization", `Bearer ${nonAdminToken}`)
      .send({
        accessPagesArray: ["/dns/nginx"],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("should allow empty array to remove all page access", async () => {
    const response = await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-pages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessPagesArray: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.user.accessPagesArray).toEqual([]);
  });
});

describe("Integration: Permission Changes Affect Machine Access", () => {
  it("should reflect updated permissions when fetching machines", async () => {
    // First, give non-admin user access to both machines
    await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-servers`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessServersArray: [machine1Id, machine2Id],
      });

    // Verify user now sees both machines
    let response = await request(app)
      .get("/machines")
      .set("Authorization", `Bearer ${nonAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.existingMachines).toHaveLength(2);

    // Now remove access to machine2
    await request(app)
      .patch(`/admin/user/${nonAdminUserId}/access-servers`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accessServersArray: [machine1Id],
      });

    // Verify user now only sees machine1
    response = await request(app)
      .get("/machines")
      .set("Authorization", `Bearer ${nonAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.existingMachines).toHaveLength(1);
    expect(response.body.existingMachines[0].publicId).toBe(machine1Id);
  });
});
