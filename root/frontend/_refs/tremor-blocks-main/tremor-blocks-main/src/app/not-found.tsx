import Link from 'next/link';

import { cx } from '@/lib/utils';

import { buttonVariants } from '@/components/Button';

import { Container } from './ui/container';
import { Icons } from './ui/icons';

export default function NotFound() {
  return (
    <Container className="flex h-full flex-col items-center pt-24 sm:pt-32 lg:pt-40">
      <Link href="/">
        <Icons.tremorBlocks className="mt-6 h-6" />
      </Link>
      <p className="mt-6 text-4xl font-semibold text-blue-500 sm:text-5xl">
        404
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Sorry, we couldn’t find the page you’re looking for.
      </p>
      <Link
        href="/"
        className={cx(buttonVariants({ variant: 'ghost' }), 'group mt-8')}
      >
        Go to the home page
        <Icons.animatedArrow className="stroke-slate-900" aria-hidden={true} />
      </Link>
    </Container>
  );
}
