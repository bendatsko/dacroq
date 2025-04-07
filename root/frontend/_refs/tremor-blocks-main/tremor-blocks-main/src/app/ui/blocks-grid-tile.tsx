import Image from 'next/image';
import Link from 'next/link';
import { BlocksCategoryMetadata } from '@/content/declarations';
import clsx from 'clsx';

import { toBase64 } from '../../../utils/to-base-64';
import { shimmer } from './assets/shimmer';
import { Icons } from './icons';

export default function BlocksGridTile({
  id,
  name,
  count,
  thumbnail,
}: BlocksCategoryMetadata) {
  return (
    <Link key={`${id}-${name}`} href={`blocks/${id}`}>
      <div className={clsx('group relative rounded-lg')}>
        <div className="overflow-hidden rounded-lg border border-gray-200/70 bg-gray-50/50 ring-gray-100 transition-all group-hover:border-gray-300/80 group-hover:ring-4">
          <div className="relative aspect-[2/1] overflow-hidden rounded-md transition-all">
            <Image
              src={thumbnail}
              alt={`Thumbnail ${name}`}
              className="absolute inset-0 h-full w-full scale-[101%] transition-all group-hover:scale-[102%]"
              width="768"
              placeholder={`data:image/svg+xml;base64,${toBase64(shimmer(768, 384))}`}
              height="384"
              priority={true}
            />
          </div>
        </div>
        <div className="px-0 py-3">
          <div className="flex items-center justify-between">
            <h3 className="inline-flex items-center font-medium text-slate-900 transition sm:text-sm">
              <span className="absolute inset-0" aria-hidden={true} />
              {name}
              <Icons.animatedArrow />
            </h3>
          </div>
          <p className="mt-1 text-sm text-slate-600">{count} blocks</p>
        </div>
      </div>
    </Link>
  );
}
