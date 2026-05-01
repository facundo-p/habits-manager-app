/**
 * driveBackupService.restore.test.ts — Tests del flow de restore (Phase 3, plan 03-03).
 *
 * Mockea SDK + fetch + expo-file-system/legacy + backupService. Cubre:
 *   - prepareRestore: happy path (counts derivados de data) + parse failure → DriveError(GENERIC)
 *   - applyRestore: orden estricto (build → write → restore → cleanup)
 *   - applyRestore: cache write fail no aborta restore (best-effort, D-19)
 *   - applyRestore: restoreData throws → cleanup NO corre (cache previo conservado, warning #9)
 *   - applyRestore: cleanup borra sólo cozyhabits-pre-restore-*.json
 *
 * Convención de mocks: jest.doMock + virtual:true + require post-mock (replicar
 * patrón de driveBackupService.test.ts y speechRecognition.test.ts).
 */

const restoreDataMock = jest.fn();
const parseAndValidateMock = jest.fn();
const buildBackupDataMock = jest.fn();
const writeAsStringAsyncMock = jest.fn();
const readDirectoryAsyncMock = jest.fn();
const deleteAsyncMock = jest.fn();

jest.doMock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: writeAsStringAsyncMock,
  readDirectoryAsync: readDirectoryAsyncMock,
  deleteAsync: deleteAsyncMock,
}));

jest.doMock(
  '@react-native-google-signin/google-signin',
  () => ({
    GoogleSignin: {
      configure: jest.fn(),
      signInSilently: jest.fn().mockResolvedValue({ type: 'success', data: { user: { email: 'a@b.com' } } }),
      getTokens: jest.fn().mockResolvedValue({ accessToken: 'fake_token' }),
    },
    statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
  }),
  { virtual: true },
);

jest.doMock('../services/backupService', () => ({
  buildBackupData: buildBackupDataMock,
  parseAndValidate: parseAndValidateMock,
  restoreData: restoreDataMock,
}));

const { prepareRestore, applyRestore, DriveError } = require('../services/driveBackupService');

const SAMPLE_BACKUP = {
  version: 1,
  exportedAt: '2026-04-27T00:00:00Z',
  habits: [{ id: '1' }],
  performed_habits: [],
  mood_entries: [],
  daily_assignments: [],
};

describe('restore flow (prepareRestore + applyRestore)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // ─── Mock defaults — todos los tests heredan estos comportamientos ──
    // parseAndValidate: passthrough JSON parse (Test 4 self-contained gracias a esto)
    parseAndValidateMock.mockImplementation((json: string) => JSON.parse(json));
    // restoreData: success por defecto
    restoreDataMock.mockResolvedValue(undefined);
    // buildBackupData: snapshot vacío
    buildBackupDataMock.mockResolvedValue({
      version: 1, exportedAt: 'snapshot', habits: [], performed_habits: [], mood_entries: [], daily_assignments: [],
    });
    // FS mocks: success
    writeAsStringAsyncMock.mockResolvedValue(undefined);
    readDirectoryAsyncMock.mockResolvedValue([
      'cozyhabits-pre-restore-2026-04-01-old.json',
      'cozyhabits-pre-restore-2026-03-01-old.json',
      'cozyhabits-pre-restore-2026-04-27T00-00-00-000Z.json', // el más reciente (recién escrito)
      'unrelated.json',
    ]);
    deleteAsyncMock.mockResolvedValue(undefined);
    // fetch para downloadBackup
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(SAMPLE_BACKUP),
    });
  });

  // ── prepareRestore ──────────────────────────────────────────────────

  test('prepareRestore: descarga UNA vez, parsea, devuelve counts; NO toca DB / cache / cleanup', async () => {
    const result = await prepareRestore('fileXYZ');

    // download exactly once
    expect((global.fetch as jest.Mock)).toHaveBeenCalledTimes(1);
    // counts derivados de data
    expect(result.counts).toEqual({ habits: 1, performed_habits: 0, mood_entries: 0, daily_assignments: 0 });
    expect(result.exportedAt).toBe('2026-04-27T00:00:00Z');
    expect(result.data.habits).toHaveLength(1);

    // No mutación
    expect(restoreDataMock).not.toHaveBeenCalled();
    expect(writeAsStringAsyncMock).not.toHaveBeenCalled();
    expect(readDirectoryAsyncMock).not.toHaveBeenCalled();
    expect(deleteAsyncMock).not.toHaveBeenCalled();
  });

  test('prepareRestore: parseAndValidate falla → DriveError(ALERT_DRIVE_GENERIC); cache + DB intactos', async () => {
    parseAndValidateMock.mockImplementationOnce(() => { throw new Error('Formato inválido'); });

    await expect(prepareRestore('fileXYZ')).rejects.toBeInstanceOf(DriveError);
    expect(restoreDataMock).not.toHaveBeenCalled();
    expect(writeAsStringAsyncMock).not.toHaveBeenCalled();   // pre-cache no se intenta
    expect(readDirectoryAsyncMock).not.toHaveBeenCalled();   // cleanup no corre
    expect(deleteAsyncMock).not.toHaveBeenCalled();
  });

  // ── applyRestore ────────────────────────────────────────────────────

  test('applyRestore: orden estricto build → write → restore → cleanup', async () => {
    const payload = {
      data: SAMPLE_BACKUP,
      counts: { habits: 1, performed_habits: 0, mood_entries: 0, daily_assignments: 0 },
      exportedAt: SAMPLE_BACKUP.exportedAt,
    };
    await applyRestore(payload);

    const buildOrder = (buildBackupDataMock as jest.Mock).mock.invocationCallOrder[0];
    const writeOrder = (writeAsStringAsyncMock as jest.Mock).mock.invocationCallOrder[0];
    const restoreOrder = (restoreDataMock as jest.Mock).mock.invocationCallOrder[0];
    const readDirOrder = (readDirectoryAsyncMock as jest.Mock).mock.invocationCallOrder[0];

    expect(buildOrder).toBeLessThan(writeOrder);     // build snapshot antes de write
    expect(writeOrder).toBeLessThan(restoreOrder);   // cache antes de DB
    expect(restoreOrder).toBeLessThan(readDirOrder); // cleanup DESPUÉS de DB success (warning #9)

    expect(restoreDataMock).toHaveBeenCalledTimes(1);
    expect(restoreDataMock).toHaveBeenCalledWith(SAMPLE_BACKUP);
  });

  test('applyRestore: cleanup borra sólo cozyhabits-pre-restore-*.json y preserva el más reciente (WR-02)', async () => {
    const payload = {
      data: SAMPLE_BACKUP,
      counts: { habits: 1, performed_habits: 0, mood_entries: 0, daily_assignments: 0 },
      exportedAt: SAMPLE_BACKUP.exportedAt,
    };
    await applyRestore(payload);

    const deletePaths = (deleteAsyncMock as jest.Mock).mock.calls.map((c) => c[0]);
    // Los pre-restore caches viejos sí se borran
    expect(deletePaths).toEqual(expect.arrayContaining([
      'file:///cache/cozyhabits-pre-restore-2026-04-01-old.json',
      'file:///cache/cozyhabits-pre-restore-2026-03-01-old.json',
    ]));
    // Archivos no relacionados nunca se tocan
    expect(deletePaths).not.toContain('file:///cache/unrelated.json');
    // WR-02: el cache más reciente (el que acabamos de escribir) DEBE sobrevivir
    // para que el usuario pueda revertir si algo salió mal después del restore.
    expect(deletePaths).not.toContain(
      'file:///cache/cozyhabits-pre-restore-2026-04-27T00-00-00-000Z.json',
    );
  });

  test('applyRestore: cache write falla → restore CONTINÚA (best-effort, D-19)', async () => {
    // Self-contained: parseAndValidateMock default (passthrough) ya quedó configurado
    // en beforeEach. El payload pasa directo, no requiere parse adicional.
    writeAsStringAsyncMock.mockRejectedValueOnce(new Error('disk full'));
    const payload = {
      data: SAMPLE_BACKUP,
      counts: { habits: 1, performed_habits: 0, mood_entries: 0, daily_assignments: 0 },
      exportedAt: SAMPLE_BACKUP.exportedAt,
    };

    await expect(applyRestore(payload)).resolves.toBeUndefined();
    expect(restoreDataMock).toHaveBeenCalledTimes(1);
    // Cleanup post-success igual corre
    expect(readDirectoryAsyncMock).toHaveBeenCalledTimes(1);
  });

  test('applyRestore: restoreData throws → DriveError + cleanup NO corre (cache previo conservado)', async () => {
    restoreDataMock.mockRejectedValueOnce(new Error('SQL boom'));
    const payload = {
      data: SAMPLE_BACKUP,
      counts: { habits: 1, performed_habits: 0, mood_entries: 0, daily_assignments: 0 },
      exportedAt: SAMPLE_BACKUP.exportedAt,
    };

    await expect(applyRestore(payload)).rejects.toBeInstanceOf(DriveError);
    // Pre-cache write SÍ ocurrió (es lo que protege al usuario)
    expect(writeAsStringAsyncMock).toHaveBeenCalledTimes(1);
    // Cleanup NO corrió — el cache previo (y el que acabamos de escribir) sobreviven
    expect(readDirectoryAsyncMock).not.toHaveBeenCalled();
    expect(deleteAsyncMock).not.toHaveBeenCalled();
  });
});
