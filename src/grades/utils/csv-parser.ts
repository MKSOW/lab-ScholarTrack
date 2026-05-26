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

// Parse un buffer CSV en tableau de lignes structurées.
// Format attendu (en-tête obligatoire) :
//   studentId,assessmentTypeId,value,comment
// La colonne comment est optionnelle et peut contenir des virgules.
export function parseCsvBuffer(buffer: Buffer): CsvParseResult {
  const text = buffer
    .toString('utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], parseError: 'Le fichier CSV est vide' };
  }

  const header = lines[0].trim().toLowerCase();
  const expectedHeader = 'studentid,assessmenttypeid,value,comment';
  if (header !== expectedHeader) {
    return {
      rows: [],
      parseError: `En-tête invalide. Attendu : "studentId,assessmentTypeId,value,comment". Reçu : "${lines[0].trim()}"`,
    };
  }

  const rows: CsvGradeRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // On split en max 4 parties pour que la colonne comment puisse contenir des virgules
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
