"use client";

import { Card } from "@/components/ui/card";
import { RiCheckLine, RiDeleteBin6Line, RiDownloadLine, RiErrorWarningLine, RiFileTextLine, RiTimeLine, RiUploadLine } from "@remixicon/react";
import { Badge, Button, Callout, ProgressBar, Text, Title } from "@tremor/react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

// Types
type FileStatus = "pending" | "processing" | "completed" | "failed";

interface QueuedFile {
  id: string;
  name: string;
  status: FileStatus;
  uploadTime: string;
  size: number;
  type: string;
  error?: string;
}

interface FileGroup {
  cnf?: QueuedFile;
  csv?: QueuedFile;
  isComplete: boolean;
}

export default function CNFConverter() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [apiStatus, setApiStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);

  // Use environment variable for API URL with fallback
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Group files by their base names (without extension)
  const groupedFiles = files.reduce((groups: { [key: string]: FileGroup }, file) => {
    const baseName = file.name.replace(/\.(cnf|csv)$/i, '');
    if (!groups[baseName]) {
      groups[baseName] = { isComplete: false };
    }

    if (file.name.toLowerCase().endsWith('.cnf')) {
      groups[baseName].cnf = file;
    } else if (file.name.toLowerCase().endsWith('.csv')) {
      groups[baseName].csv = file;
    }

    groups[baseName].isComplete = Boolean(groups[baseName].cnf && groups[baseName].csv);
    return groups;
  }, {});

  // API health check with better error handling
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(`${API_BASE_URL}/health`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          setApiStatus('connected');
          setError(null);
        } else {
          const errorText = await response.text();
          setApiStatus('error');
          setError(`API Error: ${response.status} - ${errorText || response.statusText}`);
          console.error('API Error:', response.status, errorText);
        }
      } catch (error) {
        setApiStatus('error');
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            setError('API request timed out. Please check your connection.');
          } else {
            setError(`Connection error: ${error.message}`);
          }
          console.error('API Connection Error:', error);
        } else {
          setError('Failed to connect to API');
        }
      }
    };

    // Initial check
    checkHealth();

    // Poll every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => {
      clearInterval(interval);
    };
  }, [API_BASE_URL]);

  // Queue status polling with better error handling
  useEffect(() => {
    const pollQueue = async () => {
      if (apiStatus !== 'connected') return;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_BASE_URL}/queue-status`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setFiles(Array.isArray(data) ? data : []);
          setError(null);
        } else {
          const errorText = await response.text();
          setError(`Queue status error: ${response.status} - ${errorText || response.statusText}`);
          setFiles([]);
        }
      } catch (error) {
        console.error('Queue polling error:', error);
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            setError('Queue status request timed out');
          } else {
            setError(`Queue error: ${error.message}`);
          }
        } else {
          setError('Error fetching queue status');
        }
        setFiles([]);
      }
    };

    // Initial poll
    pollQueue();

    // Poll every 3 seconds if connected
    const interval = setInterval(pollQueue, 3000);
    return () => {
      clearInterval(interval);
    };
  }, [API_BASE_URL, apiStatus]);

  // Update uploadFile function with better error handling
  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/upload`, true);
      xhr.timeout = 30000; // 30 second timeout

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: progress
          }));
        }
      };

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} - ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
      });

      xhr.send(formData);
      await uploadPromise;

      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[file.name];
        return newProgress;
      });

    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[file.name];
        return newProgress;
      });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      uploadFile(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.cnf'],
      'text/csv': ['.csv'],
      'application/zip': ['.zip']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const clearQueue = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/clear-queue`, {
        method: 'POST',
      });
      if (response.ok) {
        setFiles([]);
        setError(null);
      } else {
        setError('Failed to clear queue');
      }
    } catch (error) {
      setError('Error clearing queue');
    }
  };

  const downloadFile = async (filename: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/download-file?file=${encodeURIComponent(filename)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to download file');
      }
    } catch (error) {
      setError('Error downloading file');
    }
  };

  const downloadAll = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/download-all`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'completed_files.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to download files');
      }
    } catch (error) {
      setError('Error downloading files');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return "Date unavailable";
      }
      return date.toLocaleString();
    } catch {
      return "Date unavailable";
    }
  };

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case 'completed':
        return <RiCheckLine className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <RiErrorWarningLine className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <RiTimeLine className="h-5 w-5 text-blue-500" />;
      default:
        return <RiFileTextLine className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Title>CNF File Converter</Title>
        <Badge
          size="sm"
          color={apiStatus === 'connected' ? 'green' : apiStatus === 'connecting' ? 'yellow' : 'red'}
        >
          {apiStatus === 'connected' ? 'API Connected' : apiStatus === 'connecting' ? 'Connecting...' : 'API Error'}
        </Badge>
      </div>

      {error && (
        <Callout title="Error" color="red" icon={RiErrorWarningLine}>
          {error}
        </Callout>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Upload Area */}
        <div className="space-y-4">
          <Card>
            <Text className="font-medium mb-4">File Upload Instructions</Text>
            <Text className="text-sm text-gray-600 mb-2">
              1. Upload a CNF file containing your SAT formula
            </Text>
            <Text className="text-sm text-gray-600 mb-2">
              2. Upload a matching CSV file with the same base name
            </Text>
            <Text className="text-sm text-gray-600">
              Example: For 'problem.cnf', upload 'problem.csv'
            </Text>
          </Card>

          <Card className="border-2 border-dashed">
            <div
              {...getRootProps()}
              className={`p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'bg-blue-50 border-blue-200' : ''}`}
            >
              <input {...getInputProps()} />
              <RiUploadLine className="mx-auto h-12 w-12 text-gray-400" />
              <Text className="mt-2">
                {isDragActive ? "Drop files here..." : "Drag files here or click to browse"}
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                Supported formats: CNF, CSV, ZIP (containing CNF/CSV files)
              </Text>
              <Text className="text-sm text-gray-500">
                Maximum file size: 50MB
              </Text>
            </div>
          </Card>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <Card>
              <Text className="font-medium mb-4">Uploads in Progress</Text>
              <div className="space-y-3">
                {Object.entries(uploadProgress).map(([filename, progress]) => (
                  <div key={filename} className="space-y-1">
                    <div className="flex justify-between">
                      <Text className="text-sm">{filename}</Text>
                      <Text className="text-sm">{Math.round(progress)}%</Text>
                    </div>
                    <ProgressBar value={progress} color="blue" />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Queue Status */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Text className="font-medium">Processing Queue</Text>
            <div className="space-x-2">
              <Button
                size="xs"
                variant="secondary"
                icon={RiDeleteBin6Line}
                onClick={clearQueue}
                disabled={files.length === 0}
              >
                Clear Queue
              </Button>
              <Button
                size="xs"
                variant="primary"
                icon={RiDownloadLine}
                onClick={downloadAll}
                disabled={!files.some(f => f.status === 'completed')}
              >
                Download All
              </Button>
            </div>
          </div>

          <Card>
            <div className="space-y-4">
              {Object.entries(groupedFiles).length === 0 ? (
                <div className="text-center py-8">
                  <Text className="text-gray-500">No files in queue</Text>
                </div>
              ) : (
                Object.entries(groupedFiles).map(([baseName, group]) => (
                  <Card key={baseName} className="bg-gray-50">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Text className="font-medium">{baseName}</Text>
                        <Badge
                          size="sm"
                          color={group.isComplete ? 'green' : 'yellow'}
                        >
                          {group.isComplete ? 'Complete Set' : 'Incomplete Set'}
                        </Badge>
                      </div>

                      {/* CNF File */}
                      {group.cnf && (
                        <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(group.cnf.status)}
                            <div>
                              <Text className="font-medium">{group.cnf.name}</Text>
                              <Text className="text-sm text-gray-500">
                                {formatBytes(group.cnf.size)} • {formatDate(group.cnf.uploadTime)}
                              </Text>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge size="sm" color={
                              group.cnf.status === 'completed' ? 'green' :
                                group.cnf.status === 'processing' ? 'blue' :
                                  group.cnf.status === 'failed' ? 'red' : 'yellow'
                            }>
                              {group.cnf.status}
                            </Badge>
                            {(group.cnf.status === 'completed' || group.cnf.status === 'failed') && (
                              <Button
                                size="xs"
                                variant={group.cnf.status === 'completed' ? "light" : "secondary"}
                                icon={RiDownloadLine}
                                onClick={() => downloadFile(group.cnf!.name)}
                              >
                                {group.cnf.status === 'failed' ? 'Download Log' : 'Download'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* CSV File */}
                      {group.csv && (
                        <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(group.csv.status)}
                            <div>
                              <Text className="font-medium">{group.csv.name}</Text>
                              <Text className="text-sm text-gray-500">
                                {formatBytes(group.csv.size)} • {formatDate(group.csv.uploadTime)}
                              </Text>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge size="sm" color={
                              group.csv.status === 'completed' ? 'green' :
                                group.csv.status === 'processing' ? 'blue' :
                                  group.csv.status === 'failed' ? 'red' : 'yellow'
                            }>
                              {group.csv.status}
                            </Badge>
                            {(group.csv.status === 'completed' || group.csv.status === 'failed') && (
                              <Button
                                size="xs"
                                variant={group.csv.status === 'completed' ? "light" : "secondary"}
                                icon={RiDownloadLine}
                                onClick={() => downloadFile(group.csv!.name)}
                              >
                                {group.csv.status === 'failed' ? 'Download Log' : 'Download'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Error Messages */}
                      {(group.cnf?.error || group.csv?.error) && (
                        <Callout
                          title="Processing Error"
                          color="red"
                          className="mt-2"
                        >
                          {group.cnf?.error || group.csv?.error}
                        </Callout>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}