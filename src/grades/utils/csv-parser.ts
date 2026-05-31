export interface CsvGradeRow {
  rowNumber: number;
  studentId: string;
  assessmentTypeId: string;
  value: string;
  comment: string | undefined;
}

export interface CsvParseResult {
  rows: CsvGradeRow[];
  parseError?: string;
}

// Parses a CSV buffer into an array of structured rows.
// Expected format (header required):
//   studentId,assessmentTypeId,value,comment
// The comment column is optional and may contain commas.
export function parseCsvBuffer(buffer: Buffer): CsvParseResult {
  const text = buffer
    .toString('utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], parseError: 'The CSV file is empty' };
  }

  const header = lines[0].trim().toLowerCase();
  const expectedHeader = 'studentid,assessmenttypeid,value,comment';
  if (header !== expectedHeader) {
    return {
      rows: [],
      parseError: `Invalid header. Expected: "studentId,assessmentTypeId,value,comment". Received: "${lines[0].trim()}"`,
    };
  }

  const rows: CsvGradeRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Split into at most 4 parts so the comment column can contain commas
    const parts = line.split(',');
    const studentId = parts[0]?.trim() ?? '';
    const assessmentTypeId = parts[1]?.trim() ?? '';
    const value = parts[2]?.trim() ?? '';
    const commentRaw = parts.slice(3).join(',').trim();

    rows.push({
      rowNumber: i + 1,
      studentId,
      assessmentTypeId,
      value,
      comment: commentRaw || undefined,
    });
  }

  return { rows };
}
