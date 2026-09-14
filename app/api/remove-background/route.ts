import { env, waitUntil } from 'cloudflare:workers';
import { handleRemoval } from '@/edge/removal.mjs';
import { trackSuccessfulRemoval } from '@/edge/stats.mjs';

export async function POST(request: Request) {
  return trackSuccessfulRemoval(
    await handleRemoval(request, env),
    request,
    env.BGPOOF_STATS,
    waitUntil,
  );
}
