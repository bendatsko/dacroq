"use client";

import { RiAddLine, RiBookOpenLine, RiDatabase2Line, RiEyeLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// Tremor Table Components
import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@tremor/react";

// Components
import { Button } from "@/components/Button";
import { Card, CardContent } from "@/components/ui/card";
import CreateTestWindow from "./CreateTestWindow";
import TestDetails from "./TestDetails";

// Firestore
import { db } from "@/lib/firebase";
import { addDoc, collection, onSnapshot } from "firebase/firestore";

// Types
import { TestRun } from "@/types/test";

export default function Dashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Load tests from Firestore and validate the user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/login");
      return;
    }
    try {
      const user = JSON.parse(storedUser);
      setIsAdmin(user.role === "admin");
      const unsubscribe = onSnapshot(
        collection(db, "tests"),
        (snapshot) => {
          const testsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as TestRun[];
          // Sort tests by creation date, descending
          testsData.sort((a, b) => {
            const dateA = a.created && a.created.seconds !== undefined
              ? a.created.seconds * 1000
              : new Date(a.created).getTime();
            const dateB = b.created && b.created.seconds !== undefined
              ? b.created.seconds * 1000
              : new Date(b.created).getTime();
            return dateB - dateA;
          });
          setTests(testsData);
          setIsLoading(false);
        },
        (err) => {
          console.error("Error fetching tests:", err);
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.error("Error parsing user data:", err);
      router.push("/login");
    }
  }, [router]);

  // Create test handler
  const handleCreateTest = async (testName: string, chipType: string) => {
    try {
      const storedUserStr = localStorage.getItem("user");
      const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
      if (!storedUser) {
        setError("You must be logged in to create a test");
        return;
      }
      const newTest = {
        name: testName,
        chipType,
        status: "queued",
        created: new Date().toISOString(),
        createdBy: {
          uid: storedUser.uid,
          name: storedUser.displayName,
          email: storedUser.email,
          role: storedUser.role || "user",
          photoURL: storedUser.photoURL,
        },
      };
      await addDoc(collection(db, "tests"), newTest);
      setIsOpen(false);
    } catch (err) {
      console.error("Error creating test:", err);
      setError("Failed to create test");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Button variant="ghost" disabled>
          Loading...
        </Button>
      </div>
    );
  }

  if (selectedTest) {
    return <TestDetails test={selectedTest} onBack={() => setSelectedTest(null)} />;
  }

  return (
    <main className="container max-w-6xl mx-auto p-4 space-y-6">
      {/* Header and Navigation Cards */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
          Dashboard
        </h1>
        <p className="mt-1 text-lg text-gray-600 dark:text-gray-400">
          Manage your reports, documentation, and tools.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Documentation Card */}
          <Card
            className="cursor-pointer"
            onClick={() => router.push("/documentation")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <RiBookOpenLine className="h-8 w-8 text-gray-700 dark:text-gray-300" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Documentation
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Explore the docs for detailed information.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tools Card */}
          <Card className="cursor-pointer" onClick={() => router.push("/tools")}>
            <CardContent className="p-5 flex items-center gap-4">
              <RiDatabase2Line className="h-8 w-8 text-gray-700 dark:text-gray-300" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Tools
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Perform data analysis and conversions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Test Results Table */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Test Results
          </h2>
          <Button onClick={() => setIsOpen(true)} className="flex items-center gap-2">
            <RiAddLine className="h-5 w-5" />
            New Test
          </Button>
        </div>
        <Table className="mt-4">
          <TableHead>
            <TableRow className="border-b border-tremor-border dark:border-dark-tremor-border">
              <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong">
                Test Name
              </TableHeaderCell>
              <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong">
                Creator
              </TableHeaderCell>
              <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong">
                Chip Type
              </TableHeaderCell>
              <TableHeaderCell className="text-tremor-content-strong dark:text-dark-tremor-content-strong">
                Status
              </TableHeaderCell>
              <TableHeaderCell className="text-right text-tremor-content-strong dark:text-dark-tremor-content-strong">
                Actions
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tests.map((test) => (
              <TableRow
                key={test.id}
                className="group border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <TableCell className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  {test.name && test.name.length > 25 ? `${test.name.substring(0, 25)}...` : test.name}
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <img
                      src={
                        test.createdBy?.photoURL ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${test.createdBy?.name || "User"}`
                      }
                      alt="Creator Avatar"
                      className="h-8 w-8 rounded-full"
                    />
                  </div>
                </TableCell>
                <TableCell>{test.chipType}</TableCell>
                <TableCell>
                  <div
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                      test.status === "completed"
                        ? "bg-green-500/10 text-green-500"
                        : test.status === "running"
                        ? "bg-blue-500/10 text-blue-500"
                        : test.status === "failed"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-gray-500/10 text-gray-500"
                    )}
                  >
                    {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedTest(test)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <RiEyeLine className="mr-1 h-4 w-4" />
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateTestWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onTestComplete={(testId) => {
          const test = tests.find((t) => t.id === testId);
          if (test) setSelectedTest(test);
        }}
      />

      {error && <div className="text-red-500 text-sm">{error}</div>}
    </main>
  );
}
