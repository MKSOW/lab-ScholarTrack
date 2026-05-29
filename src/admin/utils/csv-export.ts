// Escapes a single CSV cell value per RFC 4180:
// wrap in double-quotes if the value contains a comma, double-quote, or newline.
export function escapeCsvValue(
  val: string | number | null | undefined,
): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (
    s.includes(',') ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r')
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvRow(
  values: (string | number | null | undefined)[],
): string {
  return values.map(escapeCsvValue).join(',');
}
