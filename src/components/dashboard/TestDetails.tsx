"use client";

import { useState } from "react";
import { RiArrowLeftLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TestRun } from "@/types/test";

interface TestDetailsProps {
  test: TestRun;
  onBack: () => void;
}

export default function TestDetails({ test, onBack }: TestDetailsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <RiArrowLeftLine className="h-5 w-5" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Test Details</h1>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Test Name</h3>
            <p className="mt-1">{test.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="mt-1 capitalize">{test.status}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Created</h3>
            <p className="mt-1">{formatDate(test.created)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Chip Type</h3>
            <p className="mt-1">{test.chipType}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Created By</h3>
            <div className="mt-1 flex items-center gap-2">
              <img
                src={test.createdBy?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${test.createdBy?.name || "User"}`}
                alt="Creator Avatar"
                className="h-6 w-6 rounded-full"
              />
              <span>{test.createdBy?.name || "Unknown User"}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Add more sections for test results, graphs, etc. */}
    </div>
  );
}
