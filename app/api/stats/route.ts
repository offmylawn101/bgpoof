import { env } from 'cloudflare:workers';
import { getProcessingStats } from '@/edge/stats.mjs';

export function GET() {
  return getProcessingStats(env.BGPOOF_STATS);
}
