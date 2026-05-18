/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  watchman: false,
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
  // React Native injecta __DEV__ a runtime; en jest lo definimos como false para
  // que código gated por `if (__DEV__)` (e.g. el dev fail flag de migrationV2)
  // se comporte como production en tests.
  globals: { __DEV__: false },
  transformIgnorePatterns: ['node_modules/(?!(expo-sqlite|expo-crypto)/)'],
  moduleNameMapper: {
    // Redirige el subpath 'expo-file-system/legacy' al mock manual de expo-file-system.
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.ts',
  },
};
