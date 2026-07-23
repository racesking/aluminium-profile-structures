import { describe, expect, it } from 'vitest';
import { pruneCandidates, relativeTime } from './versionStore';

const v = (id: string, savedAt: string, auto = true, label?: string) => ({
  id,
  savedAt,
  auto,
  label,
});

describe('pruneCandidates', () => {
  it('keeps the newest N autosaves and prunes the rest', () => {
    const versions = [
      v('a', '2026-07-23T10:00:00Z'),
      v('b', '2026-07-23T11:00:00Z'),
      v('c', '2026-07-23T12:00:00Z'),
      v('d', '2026-07-23T13:00:00Z'),
    ];
    expect(pruneCandidates(versions, 2).sort()).toEqual(['a', 'b']);
  });

  it('never prunes manual checkpoints or labeled autosaves', () => {
    const versions = [
      v('manual', '2026-07-23T09:00:00Z', false),
      v('labeled', '2026-07-23T08:00:00Z', true, 'v1 frame done'),
      v('old-auto', '2026-07-23T07:00:00Z'),
      v('new-auto', '2026-07-23T10:00:00Z'),
    ];
    expect(pruneCandidates(versions, 1)).toEqual(['old-auto']);
  });

  it('input order does not matter', () => {
    const versions = [
      v('new', '2026-07-23T12:00:00Z'),
      v('oldest', '2026-07-23T01:00:00Z'),
      v('mid', '2026-07-23T06:00:00Z'),
    ];
    expect(pruneCandidates(versions, 1).sort()).toEqual(['mid', 'oldest']);
  });

  it('returns nothing when under the limit', () => {
    expect(pruneCandidates([v('a', '2026-07-23T10:00:00Z')], 50)).toEqual([]);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-07-23T12:00:00Z');

  it('formats recency buckets', () => {
    expect(relativeTime('2026-07-23T11:59:50Z', now)).toBe('just now');
    expect(relativeTime('2026-07-23T11:55:00Z', now)).toBe('5 min ago');
    expect(relativeTime('2026-07-23T09:00:00Z', now)).toBe('3 h ago');
    expect(relativeTime('2026-07-22T09:00:00Z', now)).toBe('yesterday');
    expect(relativeTime('2026-07-20T09:00:00Z', now)).toBe('3 days ago');
  });

  it('falls back to a date for older versions and to input for junk', () => {
    expect(relativeTime('2026-06-01T09:00:00Z', now)).not.toContain('ago');
    expect(relativeTime('not-a-date', now)).toBe('not-a-date');
  });
});
