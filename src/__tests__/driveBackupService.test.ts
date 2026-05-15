/**
 * driveBackupService.test.ts — Tests del transporte Drive (Phase 3).
 *
 * Mockea el SDK de google-signin + fetch global. NO testea contra Drive real.
 * Replica el patrón de speechRecognition.test.ts (jest.doMock con virtual: true).
 */

// Mock SDK ANTES de importar el service (jest.doMock + virtual: true)
jest.doMock(
  '@react-native-google-signin/google-signin',
  () => ({
    GoogleSignin: {
      configure: jest.fn(),
      signIn: jest.fn().mockResolvedValue({ type: 'success', data: { user: { email: 'a@b.com' } } }),
      signInSilently: jest.fn().mockResolvedValue({ type: 'success', data: { user: { email: 'a@b.com' } } }),
      signOut: jest.fn().mockResolvedValue(undefined),
      getTokens: jest.fn().mockResolvedValue({ accessToken: 'fake_token' }),
      hasPlayServices: jest.fn().mockResolvedValue(true),
    },
    statusCodes: {
      SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
      SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
      IN_PROGRESS: 'IN_PROGRESS',
      PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    },
  }),
  { virtual: true },
);

// Mock backupService para no tocar DB en estos tests
jest.doMock('../services/backupService', () => ({
  buildBackupData: jest.fn().mockResolvedValue({
    version: 2,
    exportedAt: '2026-04-27T00:00:00Z',
    habits: [],
    performed_habits: [],
    daily_assignments: [],
    mood_log: [],
    text_library: [],
    weekly_reviews: [],
  }),
  parseAndValidate: jest.fn(),
  restoreData: jest.fn(),
}));

const {
  signIn, signOut, signOutSafe, uploadBackup, listBackups, mapDriveError,
} = require('../services/driveBackupService');
const {
  ALERT_DRIVE_NO_NETWORK, ALERT_DRIVE_AUTH_EXPIRED, ALERT_DRIVE_QUOTA,
  ALERT_DRIVE_PERMISSION, ALERT_DRIVE_GENERIC,
} = require('../config/constants');
const { GoogleSignin } = require('@react-native-google-signin/google-signin');

describe('driveBackupService', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
    // Re-defaults tras clearAllMocks
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      type: 'success', data: { user: { email: 'a@b.com' } },
    });
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValue({
      type: 'success', data: { user: { email: 'a@b.com' } },
    });
    (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);
    (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({ accessToken: 'fake_token' });
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
  });

  describe('signIn', () => {
    test('retorna email en success', async () => {
      const result = await signIn();
      expect(result).toEqual({ email: 'a@b.com' });
    });

    test('cancelación (statusCodes.SIGN_IN_CANCELLED): retorna null sin throw', async () => {
      const cancelErr = Object.assign(new Error('cancelled'), { code: 'SIGN_IN_CANCELLED' });
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(cancelErr);
      const result = await signIn();
      expect(result).toBeNull();
    });

    test('response.type === "cancelled" retorna null', async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: 'cancelled' });
      const result = await signIn();
      expect(result).toBeNull();
    });

    test('TypeError network → DriveError(NO_NETWORK) (IN-03)', async () => {
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(
        new TypeError('Network request failed'),
      );
      await expect(signIn()).rejects.toMatchObject({
        alert: ALERT_DRIVE_NO_NETWORK,
      });
    });

    test('error genérico (no cancelled, no network) → DriveError(GENERIC) (IN-03)', async () => {
      (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(
        new Error('something else'),
      );
      await expect(signIn()).rejects.toMatchObject({
        alert: ALERT_DRIVE_GENERIC,
      });
    });
  });

  describe('signOut', () => {
    test('llama GoogleSignin.signOut (no revokeAccess per D-10)', async () => {
      await signOut();
      expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('signOutSafe (IN-07)', () => {
    test('retorna { ok: true } cuando el SDK resuelve', async () => {
      const result = await signOutSafe();
      expect(result).toEqual({ ok: true });
      expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);
    });

    test('retorna { ok: false, error } cuando el SDK rechaza — NO throws', async () => {
      const sdkErr = new Error('network down');
      (GoogleSignin.signOut as jest.Mock).mockRejectedValueOnce(sdkErr);
      const result = await signOutSafe();
      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: unknown }).error).toBe(sdkErr);
    });
  });

  describe('uploadBackup', () => {
    test('POST multipart cuando no hay backup del día', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'new_id', name: 'cozyhabits-2026-04-27.json', size: '1024' }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) });

      const result = await uploadBackup();
      expect(result.fileId).toBe('new_id');
      expect(result.overwrote).toBe(false);

      const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(uploadCall[0]).toContain('/upload/drive/v3/files');
      expect(uploadCall[1].method).toBe('POST');
      expect(uploadCall[1].headers['Content-Type']).toMatch(/multipart\/related/);
      expect(uploadCall[1].body).toContain('parents');
      expect(uploadCall[1].body).toContain('appDataFolder');
    });

    test('PATCH cuando ya hay backup del día (D-12) sin parents en metadata (Pitfall #4)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            files: [{
              id: 'existing_id',
              name: 'cozyhabits-2026-04-27.json',
              size: '1024',
              createdTime: '2026-04-27T10:00:00Z',
            }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'existing_id', name: 'cozyhabits-2026-04-27.json', size: '2048' }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) });

      const result = await uploadBackup();
      expect(result.overwrote).toBe(true);

      const patchCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(patchCall[0]).toContain('/files/existing_id');
      expect(patchCall[1].method).toBe('PATCH');
      // Pitfall #4: PATCH metadata NO debe incluir parents ni appDataFolder
      expect(patchCall[1].body).not.toContain('parents');
      expect(patchCall[1].body).not.toContain('appDataFolder');
    });

    test('Pre-flight: signInSilently se llama antes de getTokens (Pitfall #1)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'x', name: 'y', size: '0' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) });

      await uploadBackup();
      const silentOrder = (GoogleSignin.signInSilently as jest.Mock).mock.invocationCallOrder[0];
      const tokensOrder = (GoogleSignin.getTokens as jest.Mock).mock.invocationCallOrder[0];
      expect(silentOrder).toBeLessThan(tokensOrder);
    });

    test('pruning post-backup no falla el backup si list/delete tiran (Pitfall #8)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new_id', name: 'x', size: '0' }) })
        .mockRejectedValueOnce(new Error('list fail'));

      await expect(uploadBackup()).resolves.toMatchObject({ fileId: 'new_id' });
    });

    test('signInSilently rechaza (sesión revocada) → DriveError(AUTH_EXPIRED) (WR-01)', async () => {
      const sdkErr = Object.assign(new Error('SIGN_IN_REQUIRED'), { code: 'SIGN_IN_REQUIRED' });
      (GoogleSignin.signInSilently as jest.Mock).mockRejectedValueOnce(sdkErr);

      const promise = uploadBackup();
      await expect(promise).rejects.toMatchObject({
        alert: ALERT_DRIVE_AUTH_EXPIRED,
      });
    });

    test('getTokens devuelve accessToken vacío → DriveError(AUTH_EXPIRED) (WR-01)', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValueOnce({ accessToken: '' });

      await expect(uploadBackup()).rejects.toMatchObject({
        alert: ALERT_DRIVE_AUTH_EXPIRED,
      });
    });

    test('signInSilently TypeError network → DriveError(NO_NETWORK) (WR-01)', async () => {
      (GoogleSignin.signInSilently as jest.Mock).mockRejectedValueOnce(
        new TypeError('Network request failed'),
      );

      await expect(uploadBackup()).rejects.toMatchObject({
        alert: ALERT_DRIVE_NO_NETWORK,
      });
    });
  });

  describe('listBackups', () => {
    test('arma query con name contains BACKUP_FILE_PREFIX y orderBy desc', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{
            id: 'a',
            name: 'cozyhabits-2026-04-27.json',
            size: '1',
            createdTime: '2026-04-27T00:00:00Z',
          }],
        }),
      });
      const result = await listBackups();
      expect(result).toHaveLength(1);
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('spaces=appDataFolder');
      expect(url).toContain('cozyhabits-');
      expect(url).toMatch(/orderBy=createdTime\+?desc/);
    });
  });

  describe('mapDriveError', () => {
    test('TypeError network → NO_NETWORK', async () => {
      const err = new TypeError('Network request failed');
      expect(await mapDriveError(err, null)).toBe(ALERT_DRIVE_NO_NETWORK);
    });

    test('401 → AUTH_EXPIRED', async () => {
      const r = new Response('{}', { status: 401 });
      expect(await mapDriveError(null, r)).toBe(ALERT_DRIVE_AUTH_EXPIRED);
    });

    test('403 + quotaExceeded → QUOTA', async () => {
      const r = new Response('{"error":{"errors":[{"reason":"quotaExceeded"}]}}', { status: 403 });
      expect(await mapDriveError(null, r)).toBe(ALERT_DRIVE_QUOTA);
    });

    test('403 + insufficientPermissions → PERMISSION', async () => {
      const r = new Response('{"error":{"errors":[{"reason":"insufficientPermissions"}]}}', { status: 403 });
      expect(await mapDriveError(null, r)).toBe(ALERT_DRIVE_PERMISSION);
    });

    test('500 → GENERIC', async () => {
      const r = new Response('boom', { status: 500 });
      expect(await mapDriveError(null, r)).toBe(ALERT_DRIVE_GENERIC);
    });
  });
});
