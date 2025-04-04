'use client';

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './Accordion';
import { cx } from '@/lib/utils';

interface JsonExplorerProps {
  data: any;
  className?: string;
  expandAll?: boolean;
}

const JsonExplorer: React.FC<JsonExplorerProps> = ({ data, className, expandAll = false }) => {
  const renderValue = (value: any): React.ReactNode => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (value === undefined) return <span className="text-gray-500">undefined</span>;
    if (typeof value === 'boolean') return <span className="text-blue-600">{value.toString()}</span>;
    if (typeof value === 'number') {
      if (Math.abs(value) < 0.0001 || Math.abs(value) > 10000) {
        return <span className="text-green-600">{value.toExponential(3)}</span>;
      }
      return <span className="text-green-600">{Number(value.toFixed(4))}</span>;
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime()) && value.includes('T')) {
        return <span className="text-orange-600">"{date.toLocaleString()}"</span>;
      }
      return <span className="text-orange-600">"{value}"</span>;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-500">[]</span>;
      if (value.every(v => typeof v === 'number')) {
        const min = Math.min(...value);
        const max = Math.max(...value);
        const avg = value.reduce((a, b) => a + b, 0) / value.length;
        return (
          <Accordion type="multiple" defaultValue={expandAll ? ['array'] : []}>
            <AccordionItem value="array">
              <AccordionTrigger className="hover:bg-gray-50 rounded-md px-2">
                <div className="flex items-center gap-2">
                  <span>Array [{value.length}]</span>
                  <span className="text-xs text-gray-500">
                    min: {min.toFixed(2)}, max: {max.toFixed(2)}, avg: {avg.toFixed(2)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-4 border-l-2 border-gray-100">
                <div className="space-y-1">
                  {value.map((item, index) => (
                    <div key={index} className="flex gap-2 hover:bg-gray-50 rounded px-2 py-0.5">
                      <span className="text-gray-500 w-8">{index}:</span>
                      {renderValue(item)}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      }
      return (
        <Accordion type="multiple" defaultValue={expandAll ? ['array'] : []}>
          <AccordionItem value="array">
            <AccordionTrigger className="hover:bg-gray-50 rounded-md px-2">
              Array [{value.length}]
            </AccordionTrigger>
            <AccordionContent className="pl-4 border-l-2 border-gray-100">
              <div className="space-y-1">
                {value.map((item, index) => (
                  <div key={index} className="flex gap-2 hover:bg-gray-50 rounded px-2 py-0.5">
                    <span className="text-gray-500 w-8">{index}:</span>
                    {renderValue(item)}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) return <span className="text-gray-500">{}</span>;
      return (
        <Accordion type="multiple" defaultValue={expandAll ? Object.keys(value) : []}>
          {entries.map(([key, val]) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="hover:bg-gray-50 rounded-md px-2">
                <div className="flex items-center gap-2">
                  <span className="text-violet-600">{key}</span>
                  {typeof val !== 'object' && <span className="text-gray-400">:</span>}
                  {typeof val !== 'object' && renderValue(val)}
                </div>
              </AccordionTrigger>
              {typeof val === 'object' && (
                <AccordionContent className="pl-4 border-l-2 border-gray-100">
                  {renderValue(val)}
                </AccordionContent>
              )}
            </AccordionItem>
          ))}
        </Accordion>
      );
    }
    return <span>{String(value)}</span>;
  };

  return (
    <div className={cx('text-sm font-mono bg-white rounded-lg', className)}>
      {renderValue(data)}
    </div>
  );
};

export default JsonExplorer; 