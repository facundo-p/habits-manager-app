/**
 * __mocks__/expo-crypto.ts
 * Mock de expo-crypto usando el módulo crypto nativo de Node.js.
 */
import { randomUUID as nodeRandomUUID } from 'crypto';

export const randomUUID = (): string => nodeRandomUUID();

export default { randomUUID };
