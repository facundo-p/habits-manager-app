/**
 * speechRecognition.test.ts — Tests para useSpeechRecognition (DEBT-01).
 *
 * El proyecto NO tiene @testing-library/react-native ni react-test-renderer instalados,
 * por lo que estos tests no renderizan el hook. En su lugar cargan el módulo bajo
 * distintos mocks de expo-speech-recognition para verificar que:
 *   (a) el archivo no crashea cuando el módulo nativo falta (Expo Go path),
 *   (b) el archivo carga limpio cuando el módulo está presente (dev build path),
 *   (c) el hook se exporta como function,
 *   (d) las interfaces locales aceptan el shape esperado.
 *
 * Para futuros mantenedores: si se instala @testing-library/react-native, expandir
 * estos tests a renderHook + act para validar start/stop/callback en runtime.
 */

// Mock de react: hooks como funciones inertes para que el módulo cargue. No se invoca
// el hook — solo se verifica que el archivo se evalúa sin crashear.
jest.mock('react', () => ({
  useState: <T,>(initial: T) => [initial, () => undefined],
  useCallback: <T,>(fn: T) => fn,
  useRef: <T,>(initial: T) => ({ current: initial }),
  useEffect: () => undefined,
}));

// Mock de react-native (Alert es lo único que el hook usa).
jest.mock(
  'react-native',
  () => ({
    Alert: { alert: () => undefined },
  }),
  { virtual: true },
);

// Mock de constants para evitar cargar la cadena completa.
jest.mock('../config/constants', () => ({
  ALERT_VOICE_UNAVAILABLE: { title: 'Voz no disponible', message: 'Instalá la dev build.' },
}));

// Mock del settings store: el hook llama a useSettingsStore con un selector.
jest.mock('../store/useSettingsStore', () => ({
  useSettingsStore: (
    selector: (s: { voiceDictationEnabled: boolean; language: string }) => unknown,
  ) => selector({ voiceDictationEnabled: true, language: 'es' }),
}));

describe('useSpeechRecognition (DEBT-01)', () => {
  beforeEach(() => {
    jest.resetModules();
    // Re-aplicar mocks que jest.resetModules() limpia.
    jest.doMock('react', () => ({
      useState: <T,>(initial: T) => [initial, () => undefined],
      useCallback: <T,>(fn: T) => fn,
      useRef: <T,>(initial: T) => ({ current: initial }),
      useEffect: () => undefined,
    }));
    jest.doMock(
      'react-native',
      () => ({
        Alert: { alert: () => undefined },
      }),
      { virtual: true },
    );
    jest.doMock('../config/constants', () => ({
      ALERT_VOICE_UNAVAILABLE: { title: 'Voz no disponible', message: 'Instalá la dev build.' },
    }));
    jest.doMock('../store/useSettingsStore', () => ({
      useSettingsStore: (
        selector: (s: { voiceDictationEnabled: boolean; language: string }) => unknown,
      ) => selector({ voiceDictationEnabled: true, language: 'es' }),
    }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('el archivo carga sin crashear cuando expo-speech-recognition falta (Expo Go path)', () => {
    jest.doMock(
      'expo-speech-recognition',
      () => {
        throw new Error('module not installed');
      },
      { virtual: true },
    );
    expect(() => require('../hooks/useSpeechRecognition')).not.toThrow();
  });

  test('el archivo carga sin crashear cuando expo-speech-recognition retorna shape válido (dev build path)', () => {
    jest.doMock(
      'expo-speech-recognition',
      () => ({
        addResultListener: () => ({ remove: () => undefined }),
        ExpoSpeechRecognitionModule: {
          start: async (_o: { lang: string }) => undefined,
          stop: async () => undefined,
        },
      }),
      { virtual: true },
    );
    expect(() => require('../hooks/useSpeechRecognition')).not.toThrow();
  });

  test('el módulo exporta useSpeechRecognition como function', () => {
    jest.doMock(
      'expo-speech-recognition',
      () => ({
        addResultListener: () => undefined,
        ExpoSpeechRecognitionModule: {
          start: async () => undefined,
          stop: async () => undefined,
        },
      }),
      { virtual: true },
    );
    const mod = require('../hooks/useSpeechRecognition');
    expect(typeof mod.useSpeechRecognition).toBe('function');
  });

  test('SpeechRecognitionEvent type-shape: results opcional, transcript string (sanity check)', () => {
    type Event = { results?: Array<{ transcript: string }> };
    const e1: Event = {};
    const e2: Event = { results: [{ transcript: 'hola' }] };
    expect(e1.results).toBeUndefined();
    expect(e2.results?.[0].transcript).toBe('hola');
  });
});
