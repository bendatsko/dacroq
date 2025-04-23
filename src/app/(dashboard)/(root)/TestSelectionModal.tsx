'use client';

import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/Dialog';
import { Card } from '@/components/Card';
import { RiCpuLine } from '@remixicon/react';

interface TestSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TestSelectionModal({ isOpen, onClose }: TestSelectionModalProps) {
  const router = useRouter();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Test Type</DialogTitle>
          <DialogDescription>
            Choose a solver to run your SAT tests. Each solver is optimized for different types of problems.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Card 
            className="p-6 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={() => {
              onClose();
              router.push('/sat');
            }}
          >
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <RiCpuLine className="size-6 text-tremor-content-emphasis dark:text-dark-tremor-content" />
                  <h3 className="text-lg font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                    3-SAT Solver (Daedalus)
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-green-500">Online</span>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  0 in queue
                </span>
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 