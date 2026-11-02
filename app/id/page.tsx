import { HomePage } from '@/components/home-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/id');

export default function HomeId() {
  return <HomePage path="/id" />;
}
