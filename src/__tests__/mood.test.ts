/**
 * mood.test.ts — Unit tests for src/config/mood.ts.
 * Pure module, no DB / UI mocks needed.
 */

import {
  MOOD_MIN,
  MOOD_MAX,
  MOOD_STEP,
  MOOD_DEFAULT_VALUE,
  MOOD_LABELS,
  MOOD_SCALE_VERSION,
  moodLabelFor,
} from '../config/mood';
import * as constants from '../config/constants';

describe('moodLabelFor', () => {
  it('returns "muyMal" at MOOD_MIN', () => {
    expect(moodLabelFor(MOOD_MIN)).toBe('muyMal');
  });

  it('returns "muyBien" at MOOD_MAX', () => {
    expect(moodLabelFor(MOOD_MAX)).toBe('muyBien');
  });

  it('returns "neutral" for mid-range value 5.5', () => {
    expect(moodLabelFor(5.5)).toBe('neutral');
  });
});

describe('mood module surface', () => {
  it('MOOD_SCALE_VERSION === "v1"', () => {
    expect(MOOD_SCALE_VERSION).toBe('v1');
  });

  it('MOOD_LABELS has 5 entries (muyMal..muyBien)', () => {
    expect(MOOD_LABELS).toHaveLength(5);
    expect(MOOD_LABELS).toEqual(['muyMal', 'mal', 'neutral', 'bien', 'muyBien']);
  });

  it('re-exports MOOD_MIN/MAX/STEP/DEFAULT_VALUE identical to constants.ts', () => {
    expect(MOOD_MIN).toBe(constants.MOOD_MIN);
    expect(MOOD_MAX).toBe(constants.MOOD_MAX);
    expect(MOOD_STEP).toBe(constants.MOOD_STEP);
    expect(MOOD_DEFAULT_VALUE).toBe(constants.MOOD_DEFAULT_VALUE);
  });
});
