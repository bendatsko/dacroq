'use client';

import blocksComponents from '@/content/blocks-components';

import { cx } from '@/lib/utils';

export interface BlocksPreviewProps {
  blocksId: string;
  blocksCategory: string;
}

const BlocksPreview = ({ blocksId, blocksCategory }: BlocksPreviewProps) => {
  // Read the cookie value

  const BlocksComponent = blocksComponents[blocksId];

  const noPaddingCategories = ['page-shells', 'logins'];
  const applyPadding = !noPaddingCategories.includes(blocksCategory);

  return (
    <div
      className={cx(
        'rounded-lg bg-white transition-all dark:bg-gray-950',
        applyPadding ? 'p-4 sm:p-10' : 'overflow-hidden',
      )}
    >
      <BlocksComponent />
    </div>
  );
};

export default BlocksPreview;
