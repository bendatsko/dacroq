/* eslint-disable tailwindcss/no-custom-classname */
/* eslint-disable tailwindcss/classnames-order */
import clsx from 'clsx';

export const prose = clsx(
  'prose prose-tremor max-w-prose',
  'prose-headings:font-bold prose-headings:tracking-tight',
  'prose-h1:font-extrabold prose-h1:text-3xl sm:prose-h1:text-5xl',
  'prose-h2:font-semibold prose-h2:text-2xl',
  'prose-h3:font-semibold prose-h3:text-lg',
  'prose-h4:font-semibold prose-h4:text-md',
  'prose-p:text-base prose-p:leading-7',
  'prose-li:text-base/7',
  'prose-a:font-medium prose-a:no-underline prose-a:text-blue-600 hover:prose-a:text-blue-500',
  'prose-blockquote:bg-blue-50 prose-blockquote:border-none prose-blockquote:ring-1 prose-blockquote:ring-inset prose-blockquote:ring-blue-600/20 prose-blockquote:rounded-md prose-blockquote:p-4 prose-blockquote:text-sm prose-blockquote:not-italic prose-blockquote:shadow-sm',
  'prose-code:bg-slate-200 prose-code:border-none prose-code:rounded-md prose-code:p-1 prose-code:font-mono prose-code:text-sm prose-code:font-medium prose-code:before:content-none prose-code:after:content-none',
);
