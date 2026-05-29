<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## API — Admin & Reporting

All routes below are mounted under the `admin` controller and protected by the
`@Roles(Role.ADMIN)` guard: **only an authenticated `ADMIN` may call them**.
Any other role receives `403 Forbidden`. They are also documented in Swagger
under the `admin` tag (`GET /api` once the app is running).

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

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
