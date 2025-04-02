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
    if (typeof value === 'number') return <span className="text-green-600">{value}</span>;
    if (typeof value === 'string') return <span className="text-orange-600">"{value}"</span>;
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-500">[]</span>;
      return (
        <Accordion type="multiple" defaultValue={expandAll ? Object.keys(value).map(k => k.toString()) : []}>
          <AccordionItem value="array">
            <AccordionTrigger>Array [{value.length}]</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {value.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-gray-500">{index}:</span>
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
        <Accordion type="multiple" defaultValue={expandAll ? Object.keys(value).map(k => k.toString()) : []}>
          {entries.map(([key, val]) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger>
                <span className="text-violet-600">{key}</span>
                {typeof val !== 'object' && ': '}
                {typeof val !== 'object' && renderValue(val)}
              </AccordionTrigger>
              {typeof val === 'object' && (
                <AccordionContent>
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
    <div className={cx('text-sm font-mono', className)}>
      {renderValue(data)}
    </div>
  );
};

export default JsonExplorer; 