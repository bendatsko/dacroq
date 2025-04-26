import { PropsWithChildren } from 'react';

import Footer from '../ui/footer';
import { SiteHeader } from '../ui/site-header';

export default function MarketingLayout({ children }: PropsWithChildren) {
  return (
    <>
      <SiteHeader />
      {children}
      <Footer />
    </>
  );
}
