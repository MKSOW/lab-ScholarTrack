export interface CsvEnrollmentRow {
  rowNumber: number;
  studentId: string;
  courseId: string;
}

export interface CsvEnrollmentParseResult {
  rows: CsvEnrollmentRow[];
  parseError?: string;
}

// Parses a CSV buffer into enrollment rows.
// Expected format (header required):
//   studentId,courseId
export function parseEnrollmentCsvBuffer(
  buffer: Buffer,
): CsvEnrollmentParseResult {
  const text = buffer
    .toString('utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], parseError: 'Le fichier CSV est vide' };
  }

  const header = lines[0].trim().toLowerCase();
  if (header !== 'studentid,courseid') {
    return {
      rows: [],
      parseError: `En-tête invalide. Attendu : "studentId,courseId". Reçu : "${lines[0].trim()}"`,
    };
  }

  const rows: CsvEnrollmentRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    rows.push({
      rowNumber: i + 1,
      studentId: parts[0]?.trim() ?? '',
      courseId: parts[1]?.trim() ?? '',
    });
  }

  return { rows };
}
