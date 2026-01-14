"use strict";
/**
 * Integration Tests for Tiered Permissions System
 *
 * These tests verify the permission system including:
 * - User model schema with accessServersArray and accessPagesArray
 * - Login/register endpoints returning permission arrays
 * - GET /machines filtering based on user permissions
 * - Admin-only user management endpoints
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var supertest_1 = __importDefault(require("supertest"));
var mongodb_memory_server_1 = require("mongodb-memory-server");
var mongoose_1 = __importDefault(require("mongoose"));
var user_1 = require("../src/models/user");
var machine_1 = require("../src/models/machine");
var app_1 = __importDefault(require("../src/app"));
var jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
var bcrypt_1 = __importDefault(require("bcrypt"));
var crypto_1 = require("crypto");
var mongoServer;
var adminToken;
var nonAdminToken;
var adminUserId;
var nonAdminUserId;
var machine1Id;
var machine2Id;
beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    var mongoUri, machine1, machine2, adminUser, _a, _b, nonAdminUser, _c, _d;
    var _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0: return [4 /*yield*/, mongodb_memory_server_1.MongoMemoryServer.create()];
            case 1:
                // Start in-memory MongoDB
                mongoServer = _g.sent();
                mongoUri = mongoServer.getUri();
                return [4 /*yield*/, mongoose_1.default.connect(mongoUri)];
            case 2:
                _g.sent();
                return [4 /*yield*/, machine_1.Machine.create({
                        publicId: (0, crypto_1.randomUUID)(),
                        machineName: "test-machine-1",
                        urlApiForTsmNetwork: "http://localhost:3001",
                        localIpAddress: "192.168.1.100",
                        nginxStoragePathOptions: ["/etc/nginx/sites-available"],
                        servicesArray: [],
                    })];
            case 3:
                machine1 = _g.sent();
                machine1Id = machine1.publicId;
                return [4 /*yield*/, machine_1.Machine.create({
                        publicId: (0, crypto_1.randomUUID)(),
                        machineName: "test-machine-2",
                        urlApiForTsmNetwork: "http://localhost:3002",
                        localIpAddress: "192.168.1.101",
                        nginxStoragePathOptions: ["/etc/nginx/sites-available"],
                        servicesArray: [],
                    })];
            case 4:
                machine2 = _g.sent();
                machine2Id = machine2.publicId;
                _b = (_a = user_1.User).create;
                _e = {
                    publicId: (0, crypto_1.randomUUID)(),
                    email: "admin@test.com",
                    username: "admin"
                };
                return [4 /*yield*/, bcrypt_1.default.hash("password123", 10)];
            case 5: return [4 /*yield*/, _b.apply(_a, [(_e.password = _g.sent(),
                        _e.isAdmin = true,
                        _e.accessServersArray = [],
                        _e.accessPagesArray = [],
                        _e)])];
            case 6:
                adminUser = _g.sent();
                adminUserId = adminUser.publicId;
                adminToken = jsonwebtoken_1.default.sign({ id: adminUser._id }, process.env.JWT_SECRET || "test-secret");
                _d = (_c = user_1.User).create;
                _f = {
                    publicId: (0, crypto_1.randomUUID)(),
                    email: "user@test.com",
                    username: "user"
                };
                return [4 /*yield*/, bcrypt_1.default.hash("password123", 10)];
            case 7: return [4 /*yield*/, _d.apply(_c, [(_f.password = _g.sent(),
                        _f.isAdmin = false,
                        _f.accessServersArray = [machine1Id],
                        _f.accessPagesArray = ["/dns/nginx", "/servers/services"],
                        _f)])];
            case 8:
                nonAdminUser = _g.sent();
                nonAdminUserId = nonAdminUser.publicId;
                nonAdminToken = jsonwebtoken_1.default.sign({ id: nonAdminUser._id }, process.env.JWT_SECRET || "test-secret");
                return [2 /*return*/];
        }
    });
}); });
afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, mongoose_1.default.disconnect()];
            case 1:
                _a.sent();
                return [4 /*yield*/, mongoServer.stop()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
describe("User Model Schema", function () {
    it("should have accessServersArray and accessPagesArray fields with default empty arrays", function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, _a, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _b = (_a = user_1.User).create;
                    _c = {
                        publicId: (0, crypto_1.randomUUID)(),
                        email: "newuser@test.com",
                        username: "newuser"
                    };
                    return [4 /*yield*/, bcrypt_1.default.hash("password123", 10)];
                case 1: return [4 /*yield*/, _b.apply(_a, [(_c.password = _d.sent(),
                            _c)])];
                case 2:
                    user = _d.sent();
                    expect(user.accessServersArray).toEqual([]);
                    expect(user.accessPagesArray).toEqual([]);
                    expect(user.isAdmin).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("POST /users/register", function () {
    it("should return accessServersArray and accessPagesArray in response", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .post("/users/register")
                        .send({
                        email: "register@test.com",
                        password: "password123",
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(201);
                    expect(response.body.user).toHaveProperty("accessServersArray");
                    expect(response.body.user).toHaveProperty("accessPagesArray");
                    expect(response.body.user.accessServersArray).toEqual([]);
                    expect(response.body.user.accessPagesArray).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("POST /users/login", function () {
    it("should return accessServersArray and accessPagesArray for admin user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .post("/users/login")
                        .send({
                        email: "admin@test.com",
                        password: "password123",
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.user).toHaveProperty("accessServersArray");
                    expect(response.body.user).toHaveProperty("accessPagesArray");
                    expect(response.body.user.isAdmin).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should return accessServersArray and accessPagesArray for non-admin user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .post("/users/login")
                        .send({
                        email: "user@test.com",
                        password: "password123",
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.user.accessServersArray).toEqual([machine1Id]);
                    expect(response.body.user.accessPagesArray).toEqual(["/dns/nginx", "/servers/services"]);
                    expect(response.body.user.isAdmin).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("GET /machines - Permission Filtering", function () {
    it("should return all machines for admin user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .get("/machines")
                        .set("Authorization", "Bearer ".concat(adminToken))];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.result).toBe(true);
                    expect(response.body.existingMachines).toHaveLength(2);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should return only permitted machines for non-admin user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .get("/machines")
                        .set("Authorization", "Bearer ".concat(nonAdminToken))];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.result).toBe(true);
                    expect(response.body.existingMachines).toHaveLength(1);
                    expect(response.body.existingMachines[0].publicId).toBe(machine1Id);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should not return MongoDB _id field in machine response", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .get("/machines")
                        .set("Authorization", "Bearer ".concat(adminToken))];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    response.body.existingMachines.forEach(function (machine) {
                        expect(machine).not.toHaveProperty("_id");
                        expect(machine).toHaveProperty("publicId");
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should return empty array for non-admin user with no server access", function () { return __awaiter(void 0, void 0, void 0, function () {
        var emptyAccessUser, _a, _b, emptyAccessToken, response;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _b = (_a = user_1.User).create;
                    _c = {
                        publicId: (0, crypto_1.randomUUID)(),
                        email: "noaccess@test.com",
                        username: "noaccess"
                    };
                    return [4 /*yield*/, bcrypt_1.default.hash("password123", 10)];
                case 1: return [4 /*yield*/, _b.apply(_a, [(_c.password = _d.sent(),
                            _c.isAdmin = false,
                            _c.accessServersArray = [],
                            _c.accessPagesArray = [],
                            _c)])];
                case 2:
                    emptyAccessUser = _d.sent();
                    emptyAccessToken = jsonwebtoken_1.default.sign({ id: emptyAccessUser._id }, process.env.JWT_SECRET || "test-secret");
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                            .get("/machines")
                            .set("Authorization", "Bearer ".concat(emptyAccessToken))];
                case 3:
                    response = _d.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.existingMachines).toHaveLength(0);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("GET /admin/users - Admin Only", function () {
    it("should return all users for admin", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .get("/admin/users")
                        .set("Authorization", "Bearer ".concat(adminToken))];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.success).toBe(true);
                    expect(Array.isArray(response.body.users)).toBe(true);
                    expect(response.body.users.length).toBeGreaterThan(0);
                    user = response.body.users[0];
                    expect(user).toHaveProperty("publicId");
                    expect(user).toHaveProperty("email");
                    expect(user).toHaveProperty("username");
                    expect(user).toHaveProperty("isAdmin");
                    expect(user).toHaveProperty("accessServersArray");
                    expect(user).toHaveProperty("accessPagesArray");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should deny access for non-admin user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .get("/admin/users")
                        .set("Authorization", "Bearer ".concat(nonAdminToken))];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(403);
                    expect(response.body.error.code).toBe("FORBIDDEN");
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("PATCH /admin/user/:userId/access-servers - Admin Only", function () {
    it("should update user's accessServersArray for admin", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, updatedUser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-servers"))
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessServersArray: [machine1Id, machine2Id],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.success).toBe(true);
                    expect(response.body.user.accessServersArray).toEqual([machine1Id, machine2Id]);
                    return [4 /*yield*/, user_1.User.findOne({ publicId: nonAdminUserId })];
                case 2:
                    updatedUser = _a.sent();
                    expect(updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.accessServersArray).toEqual([machine1Id, machine2Id]);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should reject invalid machine publicIds", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-servers"))
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessServersArray: ["invalid-machine-id-123"],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(400);
                    expect(response.body.error.code).toBe("VALIDATION_ERROR");
                    expect(response.body.error.message).toBe("Invalid machine publicIds");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should deny access for non-admin user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-servers"))
                        .set("Authorization", "Bearer ".concat(nonAdminToken))
                        .send({
                        accessServersArray: [machine1Id],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(403);
                    expect(response.body.error.code).toBe("FORBIDDEN");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should return 404 for non-existent user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/non-existent-user-id/access-servers")
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessServersArray: [machine1Id],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(404);
                    expect(response.body.error.code).toBe("NOT_FOUND");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should allow empty array to remove all access", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-servers"))
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessServersArray: [],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.user.accessServersArray).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("PATCH /admin/user/:userId/access-pages - Admin Only", function () {
    it("should update user's accessPagesArray for admin", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, updatedUser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-pages"))
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessPagesArray: ["/dns/nginx", "/dns/registrar", "/servers/services"],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.success).toBe(true);
                    expect(response.body.user.accessPagesArray).toEqual([
                        "/dns/nginx",
                        "/dns/registrar",
                        "/servers/services",
                    ]);
                    return [4 /*yield*/, user_1.User.findOne({ publicId: nonAdminUserId })];
                case 2:
                    updatedUser = _a.sent();
                    expect(updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.accessPagesArray).toEqual([
                        "/dns/nginx",
                        "/dns/registrar",
                        "/servers/services",
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should reject page paths with spaces", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-pages"))
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessPagesArray: ["/invalid path"],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(400);
                    expect(response.body.error.code).toBe("VALIDATION_ERROR");
                    expect(response.body.error.message).toBe("Invalid page path");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should reject page paths with invalid characters", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-pages"))
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessPagesArray: ["/path@with#symbols"],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(400);
                    expect(response.body.error.code).toBe("VALIDATION_ERROR");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should accept valid page paths", function () { return __awaiter(void 0, void 0, void 0, function () {
        var validPaths, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    validPaths = [
                        "/dns/nginx",
                        "/dns/registrar",
                        "/servers/services",
                        "/admin/users-management",
                        "/some-path.with-dots",
                    ];
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                            .patch("/admin/user/".concat(nonAdminUserId, "/access-pages"))
                            .set("Authorization", "Bearer ".concat(adminToken))
                            .send({
                            accessPagesArray: validPaths,
                        })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.user.accessPagesArray).toEqual(validPaths);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should deny access for non-admin user", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-pages"))
                        .set("Authorization", "Bearer ".concat(nonAdminToken))
                        .send({
                        accessPagesArray: ["/dns/nginx"],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(403);
                    expect(response.body.error.code).toBe("FORBIDDEN");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should allow empty array to remove all page access", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-pages"))
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessPagesArray: [],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.user.accessPagesArray).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe("Integration: Permission Changes Affect Machine Access", function () {
    it("should reflect updated permissions when fetching machines", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // First, give non-admin user access to both machines
                return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                        .patch("/admin/user/".concat(nonAdminUserId, "/access-servers"))
                        .set("Authorization", "Bearer ".concat(adminToken))
                        .send({
                        accessServersArray: [machine1Id, machine2Id],
                    })];
                case 1:
                    // First, give non-admin user access to both machines
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                            .get("/machines")
                            .set("Authorization", "Bearer ".concat(nonAdminToken))];
                case 2:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.existingMachines).toHaveLength(2);
                    // Now remove access to machine2
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                            .patch("/admin/user/".concat(nonAdminUserId, "/access-servers"))
                            .set("Authorization", "Bearer ".concat(adminToken))
                            .send({
                            accessServersArray: [machine1Id],
                        })];
                case 3:
                    // Now remove access to machine2
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.default)
                            .get("/machines")
                            .set("Authorization", "Bearer ".concat(nonAdminToken))];
                case 4:
                    // Verify user now only sees machine1
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body.existingMachines).toHaveLength(1);
                    expect(response.body.existingMachines[0].publicId).toBe(machine1Id);
                    return [2 /*return*/];
            }
        });
    }); });
});
