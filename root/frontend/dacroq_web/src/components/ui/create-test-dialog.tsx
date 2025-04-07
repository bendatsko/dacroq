import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CreateTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; preset?: string; customCNF?: string }) => void;
}

const PRESETS = [
  "hardware-t_batch_2",
  "hardware-t_batch_4",
  "hardware-t_batch_3",
  "hardware-t_batch_1",
  "hardware-t_batch_0",
];

export function CreateTestDialog({
                                   open,
                                   onOpenChange,
                                   onSubmit,
                                 }: CreateTestDialogProps) {
  const [testName, setTestName] = useState("Untitled Test");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customCNF, setCustomCNF] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: testName,
      preset: selectedPreset === "custom" ? undefined : selectedPreset,
      customCNF: selectedPreset === "custom" ? customCNF : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Test</DialogTitle>
            <DialogDescription>
              Configure and run tests on the 3-SAT Solver chip
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Test Name</Label>
              <Input
                id="name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Enter test name"
              />
            </div>

            <div className="grid gap-2">
              <Label>Choose a default preset or another input method</Label>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={cn(
                      "flex items-center justify-start rounded-lg border border-gray-200 p-3 text-left text-sm transition-colors hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800",
                      selectedPreset === preset &&
                      "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950"
                    )}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedPreset("custom")}
                  className={cn(
                    "flex items-center justify-start rounded-lg border border-gray-200 p-3 text-left text-sm transition-colors hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800",
                    selectedPreset === "custom" &&
                    "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950"
                  )}
                >
                  Custom CNF
                </button>
              </div>
            </div>

            {selectedPreset === "custom" && (
              <div className="grid gap-2">
                <Label htmlFor="cnf">Custom CNF Formula</Label>
                <Textarea
                  id="cnf"
                  value={customCNF}
                  onChange={(e) => setCustomCNF(e.target.value)}
                  placeholder="p cnf [num_variables] [num_clauses]"
                  className="font-mono h-32"
                />
                <p className="text-sm text-gray-500">
                  Format: p cnf [num_variables] [num_clauses] followed by clauses, one per line, ending with 0
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedPreset || (selectedPreset === "custom" && !customCNF)}
            >
              Run Test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}