"use client";

import { Dialog, DialogPanel } from "@tremor/react";
import { useState } from "react";
import { RiCloseLine, RiCheckLine, RiCloseFill } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CreateTestWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onTestComplete?: (testId: string) => void;
}

type ChipType = "3sat" | "ldpc" | "hardware";
type TestMode = "hardware-only" | "hardware-refinement";

export default function CreateTestWindow({ isOpen, onClose, onTestComplete }: CreateTestWindowProps) {
  const [selectedChip, setSelectedChip] = useState<ChipType>("3sat");
  const [testMode, setTestMode] = useState<TestMode>("hardware-only");
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
        testMode: selectedChip === "3sat" ? testMode : null,
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

      const docRef = await addDoc(collection(db, "tests"), newTest);
      if (onTestComplete) {
        onTestComplete(docRef.id);
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

          {selectedChip === "3sat" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Test Mode
              </label>
              <Select
                value={testMode}
                onValueChange={(value) => setTestMode(value as TestMode)}
              >
                <SelectTrigger>
                  {testMode === "hardware-only" ? "Hardware Only" : "Hardware with Refinement"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hardware-only">Hardware Only</SelectItem>
                  <SelectItem value="hardware-refinement">Hardware with Refinement</SelectItem>
                </SelectContent>
              </Select>
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
