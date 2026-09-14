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
          vpc_services: [
            {
              binding: 'GRABCUT',
              service_id: '01a09d6c-84c8-79a2-8cd3-91138097e103',
              remote: true,
            },
          ],
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
