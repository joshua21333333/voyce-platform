import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? 'voyce',
  // All agent execution runs here — outside the Next.js request context.
  // This eliminates serverless timeout exposure for the 8-check eval pipeline.
  dirs: ['./src/trigger'],
  maxDuration: 300, // 5 minutes max per task — agent pipelines should complete well inside this
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
})
