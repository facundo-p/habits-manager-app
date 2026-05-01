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
  moduleNameMapper: {
    // Redirige el subpath 'expo-file-system/legacy' al mock manual de expo-file-system.
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.ts',
  },
};
