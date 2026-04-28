/**
 * googleAuth.ts — Config del SDK de Google Sign-in y silent sign-in (Phase 3).
 * configureGoogleSignin: registra webClientId + scope drive.appdata (idempotente).
 * silentSignInIfPossible: restaura sesión sin UI; si falla retorna null (no throw, D-08).
 * Llamado desde App.tsx en useEffect async no-await (no bloquea render).
 */
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { DRIVE_SCOPE } from '../config/constants';

let configured = false;

/** Configura el SDK con webClientId. Idempotente — early return si ya fue llamada. */
export function configureGoogleSignin(): void {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    console.warn('[configureGoogleSignin] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no definido — Drive backup deshabilitado');
    return;
  }
  GoogleSignin.configure({ webClientId, scopes: [DRIVE_SCOPE], offlineAccess: false });
  configured = true;
}

/**
 * Sanitiza un error del SDK para logging. Evita volcar el objeto completo —
 * que en algunas versiones del SDK trae `userInfo` / `nativeStackAndroid` con
 * fragmentos de token o hints de cuenta. Sólo `code` + `message`.
 */
function sanitizeAuthError(err: unknown): { code: string; message: string } {
  const e = err as { code?: string; message?: string } | null;
  return {
    code: e?.code ?? 'no-code',
    message: e?.message ?? String(err),
  };
}

/** Restaura sesión silenciosamente. Retorna { email } si hay sesión válida; null si no. */
export async function silentSignInIfPossible(): Promise<{ email: string } | null> {
  try {
    const response = await GoogleSignin.signInSilently();
    if (response?.type === 'success' && response.data?.user?.email) {
      return { email: response.data.user.email };
    }
    return null;
  } catch (err) {
    const { code, message } = sanitizeAuthError(err);
    console.warn('[silentSignInIfPossible]', code, message);
    return null;
  }
}
