/**
 * E2E Test Setup
 * Runs before all E2E tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PILOT_MODE = 'true';

// Suppress console logs during tests (optional)
// const originalLog = console.log;
// console.log = () => {};
