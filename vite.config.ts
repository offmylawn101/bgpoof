import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: {
          name: 'removebg',
          account_id: '78d07811c5de3b3b08e4e8b9a01301ec',
          main: 'vinext/server/fetch-handler',
          compatibility_flags: ['nodejs_compat'],
          images: { binding: 'IMAGES', remote: true },
          ratelimits: [
            {
              name: 'REMOVAL_LIMITER',
              namespace_id: '2026091402',
              simple: { limit: 10, period: 60 },
            },
          ],
        },
      }),
    ],
  };
});
