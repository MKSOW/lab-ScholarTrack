# ScholarTrack

A backend API for managing a school's **courses, students, teachers and academic
results**, built with **NestJS** and **Prisma**. The domain enforces strict
business rules: a teacher can only access their own courses, a student only sees
their own grades, course capacities are respected, grades are **weighted** per
assessment type, attendance drives an `atRisk` flag, and bulk CSV imports are
**all-or-nothing** with a full error report.

> Master 1 project — API only (no frontend).

## Tech stack

| Concern | Choice |
| ------- | ------ |
| Runtime | Node.js 20+ |
| Framework | NestJS 11 (modules, controllers, services, guards, pipes, middleware) |
| ORM | Prisma 6 |
| Database | PostgreSQL 17 (via Docker Compose) |
| Auth | Better Auth + `@thallesp/nestjs-better-auth` |
| Validation | `class-validator` + `class-transformer` |
| Docs | Swagger (OpenAPI) at `/api/docs` |
| Tests | Jest |

## Modules

| Module | Responsibility | Main routes |
| ------ | -------------- | ----------- |
| **Auth** | Login / logout via Better Auth, 3 roles (`STUDENT`, `TEACHER`, `ADMIN`). Role guard + ownership guard + manual rate-limiting middleware (429). | `/api/auth/*` |
| **Users** | Admin-only creation of `STUDENT` / `TEACHER` accounts. | `POST /users` |
| **Courses** | Course CRUD with per-role rights, configurable assessment-type weights (sum = 100), capacity-checked enrollment (via a Pipe), filtering & pagination. | `/courses` |
| **Grades** | Grade entry with course-membership checks, weighted-average computation, all-or-nothing CSV bulk import. | `/grades` |
| **Attendance** | Session creation/cancellation (soft delete), bulk attendance recording, attendance-rate + `atRisk` computation. | `/attendance` |
| **Admin** | Semester results CSV export, bulk enrollment CSV import, global semester statistics via Prisma aggregations. | `/admin` |

## Getting started

### Prerequisites

- Node.js **20+**
- Docker (for the PostgreSQL container)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Copy the example file and fill in the values (in particular a Better Auth secret
and the seed passwords):

```bash
cp .env.example .env
# generate a secret: openssl rand -base64 32
```

### 3. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 17 on port **5434** (see `docker-compose.yml`), matching
the `DATABASE_URL` in `.env.example`.

### 4. Apply the schema and generate the Prisma client

```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Seed the database (optional)

Creates the admin account plus test teachers and students from the `.env` values:

```bash
npm run seed
```

### 6. Run the API

```bash
npm run start:dev      # watch mode
# or
npm run start          # one-off
```

The API listens on `http://localhost:3006` by default.

## API documentation

Once the app is running, the interactive Swagger UI is available at:

```
http://localhost:3006/api/docs
```

Every endpoint is documented there (tags per module, request/response schemas,
status codes). The Better Auth routes are mounted under `/api/auth`.

## Scripts

| Script | Description |
| ------ | ----------- |
| `npm run start:dev` | Start in watch mode |
| `npm run start` | Start once |
| `npm run build` | Production build |
| `npm run lint` | ESLint (with auto-fix) |
| `npm run test` | Run the Jest suite |
| `npm run test:cov` | Run tests with a coverage report |
| `npm run seed` | Seed the database |
| `npx prisma migrate dev` | Create/apply a migration |
| `npx prisma generate` | Regenerate the Prisma client |

## Code quality & Git hooks

Quality is enforced automatically with **Husky**, **lint-staged** and
**commitlint** — no need to remember to run anything manually.

**On every commit** (`.husky/pre-commit`):

1. `lint-staged` runs on staged `.ts` files (`src`, `test`, `prisma`):
   - `eslint --fix`
   - `prettier --write`
2. The Jest test suite runs with `--bail` (stops at the first failure).

**On every commit message** (`.husky/commit-msg`):

- `commitlint` validates the message against **Conventional Commits**
  (`commitlint.config.js`). Allowed types: `feat`, `fix`, `chore`, `test`,
  `docs`, `refactor`, `style`, `perf`, `build`, `ci`, `revert`.

  ```
  feat(grades): add weighted average endpoint
  fix(courses): reject enrollment when course is full
  ```

> A commit is rejected if linting fails, a test fails, or the message does not
> follow the convention. Do not bypass the hooks with `--no-verify`.

## Tests

The project is tested with **Jest**. Better Auth is ESM-only and incompatible
with Jest's CommonJS runtime, so the `@thallesp/nestjs-better-auth` package is
mapped to a no-op mock (`test/mocks/nestjs-better-auth.mock.ts`) and the
`src/auth/auth.ts` module is mocked per-spec where needed.

```bash
# run the whole suite once
npx jest

# watch mode
npm run test

# coverage report
npm run test:cov
```

### What is covered

| Layer | Approach |
| ----- | -------- |
| **Services** (`Grades`, `Courses`, `Attendance`, `Admin`, `Users`) | Unit tests, direct instantiation with an in-memory Prisma mock. Business rules: weighted average, capacity, all-or-nothing CSV imports, RBAC ownership. |
| **Capacity pipe** | Unit tests on the capacity check (available / full / not found). |
| **Rate-limiting middleware** | Unit tests on the 429 threshold. |
| **Guards** (`Roles`, `Ownership`) | Unit tests on role and resource-ownership logic. |
| **Controllers** | Delegation tests (correct service method + argument order, `400` guard rails on missing files). |
| **Full scenario** | Integration test (`src/integration/full-scenario.integration.spec.ts`). |

### Integration scenario

`full-scenario.integration.spec.ts` wires the **real** controllers, services and
the capacity pipe together through a NestJS `TestingModule`, all sharing a single
**stateful in-memory Prisma double** (state created in one step is read back in
the next, like a real database). It plays an end-to-end business flow:

> admin creates a course (2 weighted assessment types) → enrolls a student
> (capacity pipe) → rejects a duplicate enrollment and a full course → teacher
> records a grade → rejects a duplicate grade and a grade for a non-enrolled
> student → partial weighted average (`isComplete: false`) → bulk CSV import of
> the missing grade → complete weighted average `15.2/20`.

It also asserts RBAC (a student cannot read another student's average) and the
all-or-nothing guarantee (one invalid CSV row ⇒ zero rows inserted).

### Coverage

Measured with `npm run test:cov` (`jest --coverage`):

| Metric | Coverage |
| ------ | -------- |
| Statements | ~90% |
| Branches | ~86% |
| Functions | ~90% |
| Lines | ~92% |

> 203 tests across 17 suites, comfortably above the 70% bonus threshold.

## API — Admin & Reporting

All routes below are mounted under the `admin` controller and protected by the
`@Roles(Role.ADMIN)` guard: **only an authenticated `ADMIN` may call them**.
Any other role receives `403 Forbidden`. They are also documented in Swagger
under the `admin` tag (`/api/docs` once the app is running).

### `POST /admin/import/enrollments` — bulk enrollment import

Imports student enrollments from a CSV file, **all-or-nothing**.

- **Body**: `multipart/form-data`, field `file` (the CSV).
- **CSV format** (header required): `studentId,courseId`
  ```csv
  studentId,courseId
  ckstud001,ckcourse001
  ckstud002,ckcourse001
  ```
- **Validation** (every row is checked before any insert): the student exists
  and has the `STUDENT` role, the course exists, the student is not already
  enrolled, no duplicate row inside the file, and the course capacity is not
  exceeded.
- **Transaction**: a single `$transaction` inserts every valid row. If **any**
  row is invalid, nothing is inserted.

| Status | Meaning |
| ------ | ------- |
| `201`  | Success — body `{ imported: number, summary: [{ courseId, courseCode, enrolled }] }` |
| `422`  | Validation failed — full error report, **no row inserted** |
| `400`  | File missing or malformed CSV (bad header / empty file) |
| `403`  | Caller is not `ADMIN` |

### `GET /admin/export/semester/:semester` — semester results CSV export

Downloads a CSV file with **one row per enrolled student per course** for the
given semester (e.g. `2026-S1`).

- **Produces**: `text/csv` (sent as an attachment `semester-<semester>-results.csv`).
- **Columns**: `studentId, studentName, studentEmail, courseCode, courseName,
  weightedAverage, isComplete, attendanceRate, atRisk`
  - `weightedAverage` — weighted average over the assessment types covered so
    far (empty when no grade exists yet).
  - `isComplete` — `true` only when assessment weights covered reach 100%.
  - `attendanceRate` — between `0` and `1` (defaults to `1` when the course has
    no sessions).
  - `atRisk` — `true` when `attendanceRate` is below the
    `ATTENDANCE_AT_RISK_THRESHOLD` (default `0.75`).

| Status | Meaning |
| ------ | ------- |
| `200`  | CSV file returned |
| `404`  | No course found for this semester |
| `403`  | Caller is not `ADMIN` |

### `GET /admin/stats/semester/:semester` — aggregated semester statistics

Returns global KPIs for a semester, computed with **Prisma aggregations**
(`groupBy`, `_avg`, `count`) to keep the work in the database.

- **Response** (`200`): course count, unique student count, total enrollments,
  per-course averages and attendance rates, global at-risk count, global
  attendance rate, and the configured `threshold`.

| Status | Meaning |
| ------ | ------- |
| `200`  | Aggregated statistics object |
| `404`  | No course found for this semester |
| `403`  | Caller is not `ADMIN` |

> **Config**: `ATTENDANCE_AT_RISK_THRESHOLD` (env, default `0.75`) is the
> attendance rate below which a student is flagged `atRisk`.

## License

This project is for educational purposes (Master 1 coursework).
