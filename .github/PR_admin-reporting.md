# Phase 6 — Admin & Reporting

## 🎯 Goal

Implement the **Admin & Reporting** module: semester results CSV export, bulk
enrollment CSV import (all-or-nothing), and global per-semester statistics via
Prisma aggregations. This PR also covers **Phase 7** (unit tests) to push
coverage above 70%.

## ✨ Features

### `POST /admin/import/enrollments` — bulk enrollment import (all-or-nothing)
- `multipart/form-data` upload (field `file`), CSV `studentId,courseId`.
- **Full validation before any insert**: student exists and has the `STUDENT`
  role, course exists, no duplicate (in the database **and** within the file),
  course capacity respected.
- Referenced entities pre-loaded in **3 parallel queries** (`Promise.all`) to
  avoid N+1.
- **All-or-nothing transaction**: if a single row is invalid, returns `422`
  with a **full error report** and **no** insert.
- `201` response: `{ imported, summary: [{ courseId, courseCode, enrolled }] }`.

### `GET /admin/export/semester/:semester` — results CSV export
- One row per enrolled student per course.
- Columns: `studentId, studentName, studentEmail, courseCode, courseName,
  weightedAverage, isComplete, attendanceRate, atRisk`.
- **Weighted average** computed from the covered `AssessmentType` weights;
  `isComplete = true` only when covered weights reach 100%.
- **Attendance rate** per (student, course) pair; `atRisk` when the rate drops
  below `ATTENDANCE_AT_RISK_THRESHOLD` (default `0.75`).
- **RFC 4180** cell escaping (commas, quotes, line breaks).
- File returned as `text/csv` (`Content-Disposition: attachment`).

### `GET /admin/stats/semester/:semester` — semester statistics
- Global KPIs computed with **Prisma aggregations** (`groupBy`, `_avg`,
  `count`) to keep the work in the database.
- Course count, unique student count, enrollment count, per-course averages and
  attendance rates, global `atRisk` student count, global rate, threshold.

> All routes are protected by `@Roles(Role.ADMIN)` (otherwise `403`) and
> documented in **Swagger** under the `admin` tag.

## 🧪 Tests

- **174 tests** green (10 suites). New specs:
  - `admin.service.spec.ts` — enrollment import (all validation branches), CSV
    export, semester stats.
  - `grades.service.spec.ts` — full `GradesService` (creation, ownership,
    weighted average, grades CSV import).
  - `courses.service.spec.ts` — `CoursesService` (CRUD, capacity, enrollment).
  - `csv-export.spec.ts` — RFC 4180 escaping.
- Coverage **> 70%** (+3 bonus target reached).
- Removed dead guards in the CSV parsers (blank lines already filtered upstream)
  → better real coverage.

## 📚 Documentation

- README: new **"API — Admin & Reporting"** section (routes, RBAC, CSV format,
  response codes).
- Swagger: `@ApiOperation`, `@ApiResponse`, `@ApiProduces`, `@ApiConsumes`,
  `@ApiBody` on each endpoint.

## 🔧 Technical notes

- Express `@Res()` response for the CSV download (`import type { Response }`
  required by `isolatedModules` + `emitDecoratorMetadata`).
- Array-form `$transaction` for the grouped enrollment inserts.

## ✅ Checklist

- [x] Lint (ESLint) clean
- [x] `jest` — 174/174 green
- [x] Coverage > 70%
- [x] Swagger up to date
- [x] README updated
- [x] Conventional commits
- [x] No hardcoded secrets (`.env.example` up to date)
