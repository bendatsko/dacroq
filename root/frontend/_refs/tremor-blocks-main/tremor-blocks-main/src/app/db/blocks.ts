import fs from 'fs';
import path from 'path';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { blocksCategoriesMetadata } from '@/content/blocks-categories';
import { blocksMetadata } from '@/content/blocks-metadata';

type Metadata = {
  title: string;
  publishedAt?: string;
  summary?: string;
  image?: string;
};

function parseFrontmatter(fileContent: string) {
  let frontmatterRegex = /---\s*([\s\S]*?)\s*---/;
  let match = frontmatterRegex.exec(fileContent);

  // Check if frontmatter exists
  if (!match) {
    // No frontmatter, return the original content with empty metadata
    return { metadata: {}, content: fileContent.trim() };
  }

  let frontMatterBlock = match[1];
  let content = fileContent.replace(frontmatterRegex, '').trim();
  let frontMatterLines = frontMatterBlock.trim().split('\n');
  let metadata: Partial<Metadata> = {};

  frontMatterLines.forEach((line) => {
    let [key, ...valueArr] = line.split(': ');
    let value = valueArr.join(': ').trim();
    value = value.replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
    metadata[key.trim() as keyof Metadata] = value;
  });

  return { metadata: metadata as Metadata, content };
}

function getMDXFiles(dir: string) {
  return fs.readdirSync(dir).filter((file) => path.extname(file) === '.mdx');
}

function readMDXFile(filePath: string) {
  let rawContent = fs.readFileSync(filePath, 'utf-8');
  return parseFrontmatter(rawContent);
}

function getMDXData(dir: string) {
  let mdxFiles = getMDXFiles(dir);
  return mdxFiles.map((file) => {
    let { metadata, content } = readMDXFile(path.join(dir, file));
    let blocksCategory = path.basename(file, path.extname(file));
    return {
      metadata,
      blocksCategory,
      content,
    };
  });
}

export function getBlocksMDX(blocksCategory: string) {
  return getMDXData(
    path.join(process.cwd(), 'src', 'content', 'markdown', blocksCategory),
  );
}

export interface BlocksProps {
  name: any;
  codeSource?: ReactNode;
  copyCode?: any;
  blocksId: string;
  blocksCategory: string;
}

export function getBlocks(params: { blocksCategory: string }) {
  const categoryMetadata = blocksCategoriesMetadata.find(
    (metadata) => metadata.id === params.blocksCategory,
  );

  const blocksData: BlocksProps[] = [];
  blocksMetadata
    .filter((blocks) => blocks.category === params.blocksCategory)
    .forEach((block) => {
      try {
        const codeSource = getBlocksMDX(block.category).find(
          (blocks) => blocks.blocksCategory === block.id,
        )?.content;

        blocksData.push({
          codeSource,
          name: block.name,
          blocksId: block.id,
          blocksCategory: block.category,
        });
      } catch (err) {
        console.error(err);
      }
    });

  if (categoryMetadata) {
    return {
      name: categoryMetadata.name,
      blocksData: blocksData,
    };
  }

  return notFound();
}
