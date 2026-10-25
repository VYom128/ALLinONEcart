import { formatDuration, formatTime } from '../format';

describe('formatDuration', () => {
  it.each([
    [0, '0 s'],
    [45, '45 s'],
    [60, '1 min'],
    [3599, '59 min'],
    [3600, '1 h'],
    [3725, '1 h 2 min'],
    [86_400, '1 d'],
    [93_600, '1 d 2 h'],
    [-5, '0 s'],
  ])('formats %d seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe('formatTime', () => {
  it('formats a valid ISO time and rejects an invalid one', () => {
    expect(formatTime('2026-10-25T08:45:10.032Z')).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(formatTime('not a date')).toBe('—');
  });
});
