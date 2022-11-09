module.exports = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc-node/jest"],
  },
  modulePathIgnorePatterns: ['lib', 'fixture'],
  testMatch: ["**/*.test.ts"],
  transformIgnorePatterns: [],
};
