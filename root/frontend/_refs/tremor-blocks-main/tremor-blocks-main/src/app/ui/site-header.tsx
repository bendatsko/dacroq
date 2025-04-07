import Link from 'next/link';

import { Icons } from './icons';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link aria-label="Tremor Logo and Home Link" href="/">
          <Icons.tremorBlocks className="h-6" />
        </Link>
        <Link
          aria-label="GitHub Link"
          href="https://github.com/tremorlabs/tremor-blocks"
          target="_blank"
          className="p-1"
        >
          <Icons.gitHub className="h-[22px]" />
        </Link>
      </div>
    </header>
  );
}
