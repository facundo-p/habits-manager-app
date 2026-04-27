/**
 * useSpeechRecognition.ts — Hook para dictado de voz.
 *
 * Intenta usar expo-speech-recognition si está disponible.
 * Si no (Expo Go), isAvailable = false y el botón de mic se oculta.
 *
 * Para habilitar: npx expo install expo-speech-recognition
 * y generar una dev build (no funciona en Expo Go).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { ALERT_VOICE_UNAVAILABLE } from '../config/constants';
import { useSettingsStore } from '../store/useSettingsStore';

// Interfaces locales — no importar del paquete (puede no estar instalado en runtime).
// Solo se tipa la superficie usada por el hook (D-11).
interface SpeechRecognitionEvent {
  results?: Array<{ transcript: string }>;
}

interface SpeechModuleInterface {
  addResultListener(
    cb: (event: SpeechRecognitionEvent) => void,
  ): { remove(): void } | undefined;
  ExpoSpeechRecognitionModule?: {
    start(opts: { lang: string }): Promise<void>;
    stop(): Promise<void>;
  };
}

let SpeechModule: SpeechModuleInterface | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SpeechModule = require('expo-speech-recognition') as SpeechModuleInterface;
} catch {
  // Módulo no disponible
}

const LOCALE_MAP: Record<string, string> = {
  es: 'es-AR',
  en: 'en-US',
};

export function useSpeechRecognition(onPartialResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const voiceEnabled = useSettingsStore((s) => s.voiceDictationEnabled);
  const language = useSettingsStore((s) => s.language);
  const locale = LOCALE_MAP[language] ?? 'es-AR';
  const callbackRef = useRef(onPartialResult);
  callbackRef.current = onPartialResult;

  const isAvailable = !!SpeechModule && voiceEnabled;

  useEffect(() => {
    if (!SpeechModule) return;
    const sub = SpeechModule.addResultListener?.((event: SpeechRecognitionEvent) => {
      const transcript = event?.results?.[0]?.transcript ?? '';
      if (transcript) callbackRef.current(transcript);
    });
    return () => sub?.remove?.();
  }, []);

  const start = useCallback(async () => {
    if (!SpeechModule) {
      Alert.alert(ALERT_VOICE_UNAVAILABLE.title, ALERT_VOICE_UNAVAILABLE.message);
      return;
    }
    try {
      setIsListening(true);
      await SpeechModule.ExpoSpeechRecognitionModule?.start?.({ lang: locale });
    } catch {
      setIsListening(false);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await SpeechModule?.ExpoSpeechRecognitionModule?.stop?.();
    } catch {
      // ignore
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isListening) {
      await stop();
    } else {
      await start();
    }
  }, [isListening, start, stop]);

  return { isListening, isAvailable, toggle };
}
