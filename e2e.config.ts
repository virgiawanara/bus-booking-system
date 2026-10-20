import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { gateway } from 'ai';

// Runner tidak membaca .env otomatis — muat untuk ADMIN_PASSWORD (credentials).
process.loadEnvFile('.env');

export default {
  // The Vercel AI Gateway serves the model id and reads AI_GATEWAY_API_KEY, or the OIDC token of a linked Vercel project.
  agents: {
    default: {
      model: gateway('openai/gpt-6-luna-fast'),
      system: 'You are a thorough QA agent. Verify every outcome.',
    },
  },
  credentials: {
    admin: { username: 'admin', password: () => process.env.ADMIN_PASSWORD ?? '' },
  },
  targets: [{
    engine: web(),
    app: {
      url: process.env.APP_URL ?? 'http://localhost:3000',
      // Attach ke dev server yang sudah jalan; bila tidak ada, runner men-start sendiri.
      command: { executable: 'npm', args: ['run', 'dev'], reuseExisting: true, log: '.e2e/logs/app.log' },
    },
  }],
} satisfies E2EConfig;
