import { buildCsvRow, escapeCsvValue } from './csv-export';

describe('escapeCsvValue', () => {
  it('returns empty string for null', () => {
    expect(escapeCsvValue(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('returns the string as-is when no special characters', () => {
    expect(escapeCsvValue('hello')).toBe('hello');
    expect(escapeCsvValue(42)).toBe('42');
  });

  it('wraps values containing a comma in double quotes', () => {
    expect(escapeCsvValue('Doe, John')).toBe('"Doe, John"');
  });

  it('wraps values containing a double-quote and escapes inner quotes', () => {
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps values containing a newline', () => {
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('buildCsvRow', () => {
  it('joins values with commas', () => {
    expect(buildCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('escapes values that need quoting', () => {
    expect(buildCsvRow(['Doe, John', '14.00'])).toBe('"Doe, John",14.00');
  });

  it('handles null and undefined in the row', () => {
    expect(buildCsvRow([null, undefined, 'x'])).toBe(',,x');
  });
});
