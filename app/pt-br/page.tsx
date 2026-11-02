import { HomePage } from '@/components/home-page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('/pt-br');

export default function HomePtBr() {
  return <HomePage path="/pt-br" />;
}
