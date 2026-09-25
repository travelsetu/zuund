import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
