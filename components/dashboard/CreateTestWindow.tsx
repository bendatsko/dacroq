"use client";

import { Dialog, DialogPanel } from "@tremor/react";
import { useState } from "react";
import { RiCloseLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

// Firestore logic removed; using parent callback to create tests

interface CreateTestWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onTestComplete?: (testName: string, chipType: ChipType) => void;
}

type ChipType = "3sat" | "ldpc" | "hardware";
type TestMode = "hardware-only" | "hardware-refinement" | "hardware-in-the-loop";

interface TestConfig {
  iterations?: number;
  timeout?: number;
  hardware?: {
    frequency: number;
    voltage: number;
    temperature: number;
  };
}

export default function CreateTestWindow({ isOpen, onClose, onTestComplete }: CreateTestWindowProps) {
  const [selectedChip, setSelectedChip] = useState<ChipType>("3sat");
  const [testMode, setTestMode] = useState<TestMode>("hardware-only");
  const [testConfig, setTestConfig] = useState<TestConfig>({
    iterations: 1000,
    timeout: 300,
    hardware: {
      frequency: 100,
      voltage: 1.2,
      temperature: 25
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const storedUserStr = localStorage.getItem("user");
      const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
      
      if (!storedUser) {
        throw new Error("You must be logged in to create a test");
      }

      const newTest = {
        name: `${selectedChip.toUpperCase()} Test`,
        chipType: selectedChip,
        testMode,
        config: testConfig,
        status: "queued",
        created: new Date().toISOString(),
        createdBy: {
          uid: storedUser.uid,
          name: storedUser.displayName || storedUser.name || "Unknown User",
          email: storedUser.email,
          role: storedUser.role || "user",
          photoURL: storedUser.photoURL,
        },
      };

      if (onTestComplete) {
        onTestComplete(newTest.name, newTest.chipType);
      }
      onClose();
    } catch (err) {
      console.error("Error creating test:", err);
      setError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} static>
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <DialogPanel className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md mx-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">New Test</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Chip</label>
            <Select
              value={selectedChip}
              onValueChange={(value) => setSelectedChip(value as ChipType)}
            >
              <SelectTrigger>
                {selectedChip.toUpperCase()}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3sat">3-SAT</SelectItem>
                <SelectItem value="ldpc">LDPC</SelectItem>
                <SelectItem value="hardware">Hardware</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Test Mode
            </label>
            <Select
              value={testMode}
              onValueChange={(value) => setTestMode(value as TestMode)}
            >
              <SelectTrigger>
                {testMode === "hardware-only" ? "Hardware Only" : 
                 testMode === "hardware-refinement" ? "Hardware with Refinement" :
                 "Hardware in the Loop"}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hardware-only">Hardware Only</SelectItem>
                <SelectItem value="hardware-refinement">Hardware with Refinement</SelectItem>
                <SelectItem value="hardware-in-the-loop">Hardware in the Loop</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {testMode === "hardware-in-the-loop" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Test Iterations
                </label>
                <input
                  type="number"
                  value={testConfig.iterations}
                  onChange={(e) => setTestConfig(prev => ({
                    ...prev,
                    iterations: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={testConfig.timeout}
                  onChange={(e) => setTestConfig(prev => ({
                    ...prev,
                    timeout: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Hardware Settings
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">Frequency (MHz)</label>
                    <input
                      type="number"
                      value={testConfig.hardware?.frequency}
                      onChange={(e) => setTestConfig(prev => ({
                        ...prev,
                        hardware: {
                          ...prev.hardware!,
                          frequency: parseFloat(e.target.value)
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Voltage (V)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={testConfig.hardware?.voltage}
                      onChange={(e) => setTestConfig(prev => ({
                        ...prev,
                        hardware: {
                          ...prev.hardware!,
                          voltage: parseFloat(e.target.value)
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Temperature (°C)</label>
                    <input
                      type="number"
                      value={testConfig.hardware?.temperature}
                      onChange={(e) => setTestConfig(prev => ({
                        ...prev,
                        hardware: {
                          ...prev.hardware!,
                          temperature: parseFloat(e.target.value)
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Test"}
            </Button>
          </div>
        </div>
      </DialogPanel>
    </Dialog>
  );
}
