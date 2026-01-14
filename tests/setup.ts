/**
 * Jest Test Setup
 * Sets up the test environment before tests run
 */

// Set NODE_ENV to test to prevent app.ts from auto-initializing
process.env.NODE_ENV = "test";

// Set JWT_SECRET for tests
process.env.JWT_SECRET = "test-secret-key-for-testing";
