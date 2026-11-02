'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const languages: Record<string, string> = {
  '/id': 'id',
  '/pt-br': 'pt-BR',
  '/es': 'es',
};

export function Html({ children }: { children: ReactNode }) {
  return <html lang={languages[usePathname()] ?? 'en'}>{children}</html>;
}
