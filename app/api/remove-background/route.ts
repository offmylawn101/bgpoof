import { env } from 'cloudflare:workers';
import { handleRemoval } from '@/edge/removal.mjs';

export async function POST(request: Request) {
  return handleRemoval(request, env);
}
