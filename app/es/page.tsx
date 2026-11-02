import { HomePage } from '@/components/home-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/es');

export default function HomeEs() {
  return <HomePage path="/es" />;
}
