'use client';

import React from 'react';
import clsx from 'clsx';

import { BlocksProps } from '../db/blocks';
import BlocksPreview from './blocks-preview';

function slugify(str: string) {
  return str
    .toString()
    .toLowerCase()
    .trim() // Remove whitespace from both ends of a string
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters except for -
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
}

function createHeading(level: string | number, text: string) {
  let slug = slugify(text);
  return React.createElement(
    `h${level}`,
    {
      id: slug,
      className: clsx(
        '-ml-[1em] cursor-pointer',
        // 'text-slate-900 text-lg font-medium truncate',
        'font-medium text-slate-900 sm:text-lg',
        'scroll-mt-20 md:scroll-mt-24',
        "before:mr-2 before:font-medium before:text-slate-400 before:opacity-0 before:content-['#']",
        'transition-opacity hover:before:opacity-100',
      ),
    },
    React.createElement(
      'a',
      {
        href: `#${slug}`,
        key: `link-${slug}`,
      },
      text,
    ),
  );
}

const Block = ({ name, blocksId, blocksCategory }: BlocksProps) => {
  return (
    <>
      <div className="mt-24 first:mt-0">
        <div
          id="block-header"
          className="sm:flex sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4">
            {createHeading(2, name)}
          </div>
        </div>
      </div>
      <div
        id="blocks-container"
        className={clsx(
          'relative mt-4 w-full rounded-lg ring-1 ring-slate-200',
        )}
      >
        <BlocksPreview blocksId={blocksId} blocksCategory={blocksCategory} />
      </div>
    </>
  );
};

export default Block;
