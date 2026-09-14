import tailwindcss from '@tailwindcss/postcss';
import { existsSync } from 'node:fs';
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
        configPath: existsSync('wrangler.local.jsonc')
          ? 'wrangler.local.jsonc'
          : 'wrangler.jsonc',
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: { main: 'vinext/server/fetch-handler' },
      }),
    ],
  };
});
