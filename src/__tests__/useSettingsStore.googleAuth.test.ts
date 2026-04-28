/**
 * useSettingsStore.googleAuth.test.ts — Tests del slice de auth de Google (Phase 3).
 *
 * Cubre setGoogleEmail, setLastBackup, clearGoogleSession y la inclusión
 * de los 3 campos en partialize. NO testea network ni el SDK — sólo state.
 */
import { useSettingsStore } from '../store/useSettingsStore';

describe('useSettingsStore — Google Drive auth slice', () => {
  beforeEach(() => {
    // Reset a defaults entre tests
    useSettingsStore.setState({
      googleEmail: null,
      lastBackupAt: null,
      lastBackupFileId: null,
    });
  });

  test('initial state: googleEmail/lastBackupAt/lastBackupFileId son null', () => {
    const s = useSettingsStore.getState();
    expect(s.googleEmail).toBeNull();
    expect(s.lastBackupAt).toBeNull();
    expect(s.lastBackupFileId).toBeNull();
  });

  test('setGoogleEmail actualiza el campo', () => {
    useSettingsStore.getState().setGoogleEmail('user@example.com');
    expect(useSettingsStore.getState().googleEmail).toBe('user@example.com');
  });

  test('setGoogleEmail(null) limpia el campo', () => {
    useSettingsStore.getState().setGoogleEmail('x@y.com');
    useSettingsStore.getState().setGoogleEmail(null);
    expect(useSettingsStore.getState().googleEmail).toBeNull();
  });

  test('setLastBackup actualiza ambos campos atómicamente', () => {
    useSettingsStore.getState().setLastBackup('2026-04-27T10:00:00Z', 'fileXYZ');
    const s = useSettingsStore.getState();
    expect(s.lastBackupAt).toBe('2026-04-27T10:00:00Z');
    expect(s.lastBackupFileId).toBe('fileXYZ');
  });

  test('clearGoogleSession limpia email pero preserva lastBackup* (D-11)', () => {
    useSettingsStore.setState({
      googleEmail: 'a@b.com',
      lastBackupAt: '2026-04-27T10:00:00Z',
      lastBackupFileId: 'fileXYZ',
    });
    useSettingsStore.getState().clearGoogleSession();
    const s = useSettingsStore.getState();
    expect(s.googleEmail).toBeNull();
    expect(s.lastBackupAt).toBe('2026-04-27T10:00:00Z');
    expect(s.lastBackupFileId).toBe('fileXYZ');
  });
});
