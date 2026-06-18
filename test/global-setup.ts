import { execSync } from 'child_process'

// Push the Prisma schema to an isolated SQLite test DB before the suite runs, so the
// integration tests run against a real database (not mocks).
export default function setup() {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  })
}
