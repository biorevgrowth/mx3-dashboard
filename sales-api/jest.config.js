export default {
  testMatch: ['**/test/**/*.test.js'],
  transform: {},
  testEnvironment: 'node',
  collectCoverageFrom: ['lib/**/*.js'],
  coverageThreshold: {
    global: { lines: 90 },
  },
};
