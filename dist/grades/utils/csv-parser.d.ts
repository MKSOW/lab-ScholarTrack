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
export declare function parseCsvBuffer(buffer: Buffer): CsvParseResult;
