"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/ui/textarea";
import {
  RiFileTextLine,
  RiDownloadLine,
  RiUploadLine,
  RiFileExcelLine,
  RiCodeLine,
} from "@remixicon/react";

export default function ToolsPage() {
  const [csvContent, setCsvContent] = useState("");
  const [jsonContent, setJsonContent] = useState("");
  const [error, setError] = useState("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      convertCsvToJson(content);
    };
    reader.readAsText(file);
  };

  const convertCsvToJson = (csv: string) => {
    try {
      setError("");
      const lines = csv.split('\n');
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = lines[0].split(',').map(header => header.trim());
      const jsonArray = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines
        
        const values = lines[i].split(',');
        const row: { [key: string]: string } = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || '';
        });
        
        jsonArray.push(row);
      }

      setJsonContent(JSON.stringify(jsonArray, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error converting CSV to JSON");
      setJsonContent("");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="container max-w-5xl mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">CSV to JSON Converter</h1>
        <p className="text-gray-500 mt-2">
          Convert your CSV files to JSON format with this simple tool
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CSV Input */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">CSV Input</h2>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="secondary" className="flex items-center gap-2">
                  <RiUploadLine className="size-4" />
                  Upload CSV
                </Button>
              </label>
            </div>
          </div>
          <Textarea
            value={csvContent}
            onChange={(e) => {
              setCsvContent(e.target.value);
              convertCsvToJson(e.target.value);
            }}
            placeholder="Paste your CSV content here or upload a file..."
            className="min-h-[300px] font-mono text-sm"
          />
        </Card>

        {/* JSON Output */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">JSON Output</h2>
            <Button
              variant="secondary"
              onClick={handleDownload}
              disabled={!jsonContent}
              className="flex items-center gap-2"
            >
              <RiDownloadLine className="size-4" />
              Download JSON
            </Button>
          </div>
          {error ? (
            <div className="text-red-500 p-4 bg-red-50 rounded-md">{error}</div>
          ) : (
            <Textarea
              value={jsonContent}
              readOnly
              placeholder="JSON output will appear here..."
              className="min-h-[300px] font-mono text-sm bg-gray-50"
            />
          )}
        </Card>
      </div>

      {/* Instructions */}
      <Card className="mt-6 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">How to Use</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <RiFileExcelLine className="size-6 text-blue-500 mt-1" />
            <div>
              <h3 className="font-medium">1. Input CSV</h3>
              <p className="text-sm text-gray-500">
                Upload a CSV file or paste CSV content directly into the input area
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RiCodeLine className="size-6 text-green-500 mt-1" />
            <div>
              <h3 className="font-medium">2. Automatic Conversion</h3>
              <p className="text-sm text-gray-500">
                The tool automatically converts your CSV to JSON format
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RiDownloadLine className="size-6 text-purple-500 mt-1" />
            <div>
              <h3 className="font-medium">3. Download JSON</h3>
              <p className="text-sm text-gray-500">
                Download the converted JSON file or copy the output
              </p>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}