'use client';

import React, { useState } from 'react';

interface JsonExplorerProps {
  data: any;
  className?: string;
}

const computeStats = (value: any): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Empty Array';
    if (value.every(item => typeof item === 'number')) {
      const min = Math.min(...value);
      const max = Math.max(...value);
      const avg = value.reduce((a, b) => a + b, 0) / value.length;
      return `min: ${min.toFixed(2)}, max: ${max.toFixed(2)}, avg: ${avg.toFixed(2)}`;
    }
    return `Array of length ${value.length}`;
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    return `Object with ${keys.length} keys`;
  }
  return String(value);
};

const JsonExplorer: React.FC<JsonExplorerProps> = ({ data, className }) => {
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderValue = (value: any) => {
    if (typeof value === 'object' && value !== null) {
      // Use a preformatted block to display the JSON structure
      return <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
    }
    return <span>{String(value)}</span>;
  };

  const renderRow = (key: string, value: any) => {
    const type = Array.isArray(value) ? 'Array' : typeof value;
    const stats = computeStats(value);
    const isExpandable = typeof value === 'object' && value !== null;
    return (
      <React.Fragment key={key}>
        <tr className="border-b">
          <td className="p-2">
            {isExpandable && (
              <button onClick={() => toggleExpand(key)} className="mr-2 text-blue-600">
                {expanded[key] ? '-' : '+'}
              </button>
            )}
            {key}
          </td>
          <td className="p-2">{type}</td>
          <td className="p-2">{stats}</td>
        </tr>
        {expanded[key] && isExpandable && (
          <tr>
            <td colSpan={3} className="p-2 bg-gray-50">
              {renderValue(value)}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  if (typeof data !== 'object' || data === null) {
    return <div className={className}>{renderValue(data)}</div>;
  }

  // If data is an array, use numeric indices; otherwise use the object's keys.
  const entries = Array.isArray(data)
    ? data.map((val, index) => [index.toString(), val])
    : Object.entries(data);

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left border-b">Key</th>
            <th className="p-2 text-left border-b">Type</th>
            <th className="p-2 text-left border-b">Stats / Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => renderRow(key, value))}
        </tbody>
      </table>
    </div>
  );
};

export default JsonExplorer;
