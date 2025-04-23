import { notFound } from 'next/navigation';

import { getBlocks } from '@/app/db/blocks';
import Block from '@/app/ui/block';
import { Container } from '@/app/ui/container';
import { CustomMDX } from '@/app/ui/mdx';

export default async function Page({
  params: { blocksCategory },
}: {
  params: { blocksCategory: string };
}) {
  const blocks = getBlocks({
    blocksCategory,
  });

  if (!blocks) {
    notFound();
  }

  return (
    <Container>
      <div id="blocks-category-header" className="mt-8 sm:mt-16">
        <span className="font-semibold leading-7 text-blue-500 hover:text-blue-500/90">
          <a href="/blocks">Tremor Blocks</a>
        </span>
        <h1 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {blocks.name}
        </h1>
      </div>
      <div
        id="blocks-category-content"
        className="mt-20 overflow-hidden px-px pb-px"
      >
        {blocks.blocksData?.map((block: any) => (
          <Block
            key={block.name}
            name={block.name}
            codeSource={
              block.codeSource && <CustomMDX source={block.codeSource} />
            }
            blocksId={block.blocksId}
            blocksCategory={block.blocksCategory}
          />
        ))}
      </div>
    </Container>
  );
}
