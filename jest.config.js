/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      diagnostics: false, // no type-check en tests; solo verificamos comportamiento
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  automock: false,
  transformIgnorePatterns: ['node_modules/(?!(expo-sqlite|expo-crypto)/)'],
};
