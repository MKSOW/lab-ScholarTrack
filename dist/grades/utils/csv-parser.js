"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsvBuffer = parseCsvBuffer;
function parseCsvBuffer(buffer) {
    const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
            continue;
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
//# sourceMappingURL=csv-parser.js.map