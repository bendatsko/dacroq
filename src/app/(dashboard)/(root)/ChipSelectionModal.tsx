'use client';

import { useState, useEffect } from 'react';
import { RiCloseLine, RiCpuLine, RiCheckLine, RiErrorWarningLine } from '@remixicon/react';
import {
  Dialog,
  DialogPanel,
  Card,
  Divider,
} from '@tremor/react';

interface Chip {
  id: string;
  name: string;
  type: '3sat' | 'ldpc' | 'hardware';
  status: 'online' | 'offline' | 'busy';
  lastPing: string;
}

interface ChipSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (chip: Chip) => void;
}

export default function ChipSelectionModal({ isOpen, onClose, onSelect }: ChipSelectionModalProps) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Fetch available chips from API
      fetchChips();
    }
  }, [isOpen]);

  const fetchChips = async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/chips');
      const data = await response.json();
      setChips(data);
    } catch (error) {
      console.error('Error fetching chips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: Chip['status']) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'busy':
        return 'text-yellow-500';
      case 'offline':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: Chip['status']) => {
    switch (status) {
      case 'online':
        return <RiCheckLine className="size-4" />;
      case 'busy':
        return <RiCpuLine className="size-4" />;
      case 'offline':
        return <RiErrorWarningLine className="size-4" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} static={true} className="z-[100]">
      <DialogPanel className="overflow-visible p-0 sm:max-w-2xl">
        <div className="absolute right-0 top-0 pr-3 pt-3">
          <button
            type="button"
            className="rounded-tremor-small p-2 text-tremor-content-subtle hover:bg-tremor-background-subtle hover:text-tremor-content dark:text-dark-tremor-content-subtle hover:dark:bg-dark-tremor-background-subtle hover:dark:text-tremor-content"
            onClick={onClose}
            aria-label="Close"
          >
            <RiCloseLine className="size-5 shrink-0" aria-hidden={true} />
          </button>
        </div>
        <div className="border-b border-tremor-border px-6 py-4 dark:border-dark-tremor-border">
          <h3 className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
            Select Chip
          </h3>
          <p className="mt-1 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
            Choose a chip to run your SAT solver test
          </p>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tremor-brand"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chips.map((chip) => (
                <Card
                  key={chip.id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                    chip.status === 'offline' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={() => chip.status !== 'offline' && onSelect(chip)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <RiCpuLine className="size-6 text-tremor-content-emphasis dark:text-dark-tremor-content" />
                      <div>
                        <h4 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                          {chip.name}
                        </h4>
                        <p className="text-tremor-label text-tremor-content dark:text-dark-tremor-content">
                          {chip.type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center space-x-1 ${getStatusColor(chip.status)}`}>
                      {getStatusIcon(chip.status)}
                      <span className="text-tremor-label capitalize">{chip.status}</span>
                    </div>
                  </div>
                  <Divider className="my-3" />
                  <p className="text-tremor-label text-tremor-content dark:text-dark-tremor-content">
                    Last ping: {chip.lastPing}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogPanel>
    </Dialog>
  );
} 