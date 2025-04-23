"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RiAddLine, RiSearchLine, RiFilterLine, RiArrowDownSLine, RiCalendarLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import CreateTestWindow from "../../../../components/dashboard/CreateTestWindow";
import TestDetails from "../../../../components/dashboard/TestDetails";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import { TestRun } from "@/types/test";

export default function Dashboard() {
  const router = useRouter();
  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("Last 12 hours");
  const [environment, setEnvironment] = useState("Production");
  const [apiHealth, setApiHealth] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Load tests from API and Firestore
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/login");
      return;
    }

    const fetchTests = async () => {
      try {
        const user = JSON.parse(storedUser);
        setIsAdmin(user.role === "admin");

        // Fetch tests from API
        const timeRangeMs = timeRange === "Last 12 hours" ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        const apiResponse = await fetch(`https://medusa.bendatsko.com/api/tests?environment=${environment.toLowerCase()}&timeRange=${timeRangeMs}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          mode: 'cors'
        });
        
        let apiTests = [];
        if (apiResponse.ok) {
          const data = await apiResponse.json();
          if (Array.isArray(data)) {
            apiTests = data;
          } else {
            console.warn('API returned non-array response:', data);
          }
        } else {
          console.warn('API returned error status:', apiResponse.status);
        }

        // Combine API tests with Firestore tests
        const unsubscribe = onSnapshot(
          collection(db, "tests"),
          (snapshot) => {
            const firestoreTests = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            // Merge and deduplicate tests from both sources
            const allTests = [...firestoreTests, ...apiTests]
              .filter((test, index, self) => 
                index === self.findIndex((t) => t.id === test.id)
              );

            // Sort tests by creation date, descending
            allTests.sort((a, b) => {
              const dateA = a.created && a.created.seconds !== undefined
                ? a.created.seconds * 1000
                : new Date(a.created).getTime();
              const dateB = b.created && b.created.seconds !== undefined
                ? b.created.seconds * 1000
                : new Date(b.created).getTime();
              return dateB - dateA;
            });

            setTests(allTests);
            setIsLoading(false);
          },
          (err) => {
            console.error("Error fetching Firestore tests:", err);
            setError("Failed to load tests from Firestore");
            setIsLoading(false);
          }
        );
        return () => unsubscribe();
      } catch (err) {
        console.error("Error loading tests:", err);
        setError("Failed to load tests");
        setIsLoading(false);
      }
    };

    fetchTests();
  }, [router, timeRange, environment]);

  // Check API health status (still needed for internal functionality)
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await fetch('https://medusa.bendatsko.com/api/health', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          mode: 'cors'
        });

        const data = await response.json();
        
        // Set API health based on status and details
        setApiHealth({
          status: data.api_status || 'error',
          cloudflare: data.cloudflare_tunnel_status || 'unknown',
          weather: {
            status: data.weather_data_status || 'unknown',
            lastUpdate: data.last_weather_update || 'Never',
            error: data.weather_data_error_details
          },
          lastChecked: new Date().toLocaleString()
        });

      } catch (error) {
        console.error('Error checking API health:', error);
        setApiHealth({
          status: 'error',
          cloudflare: 'unknown',
          weather: {
            status: 'error',
            lastUpdate: 'Never',
            error: 'Failed to connect to API'
          },
          lastChecked: new Date().toLocaleString()
        });
      }
    };

    checkApiHealth();
    const interval = setInterval(checkApiHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Create test handler
  const handleCreateTest = async (testName, chipType) => {
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
        created: serverTimestamp(),
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

  // Calculate counts by chip types
  const satTestsCount = tests.filter(test => test.chipType === "3SAT").length;
  const ldpcTestsCount = tests.filter(test => test.chipType === "LDPC").length;
  const hardwareTestsCount = tests.filter(test => test.chipType === "HARDWARE").length;
  
  // Filter tests by category and search query
  const filteredTests = tests
    .filter(test => {
      if (selectedCategory === "all") return true;
      if (selectedCategory === "3sat") return test.chipType === "3SAT";
      if (selectedCategory === "ldpc") return test.chipType === "LDPC";
      if (selectedCategory === "hardware") return test.chipType === "HARDWARE";
      if (selectedCategory === "completed") return test.status === "completed";
      if (selectedCategory === "running") return test.status === "running";
      if (selectedCategory === "failed") return test.status === "failed";
      if (selectedCategory === "queued") return test.status === "queued";
      return true;
    })
    .filter(test => 
      test.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      test.chipType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.createdBy?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.status?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Update page description for the Navigation component
  useEffect(() => {
    // Find the page description element that's part of the Navigation component
    const descElement = document.getElementById("page-description");
    if (descElement) {
      descElement.textContent = "Monitor and manage test runs across all quantum computing platforms.";
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="flex items-center space-x-2 text-blue-600">
          <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (selectedTest) {
    return <TestDetails test={selectedTest} onBack={() => setSelectedTest(null)} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      {/* Main content section */}
      <div className="mb-8">
        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-6">
          {/* Left side: Category Tabs */}
          <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700 w-full sm:w-auto overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap",
                selectedCategory === "all"
                  ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              All Tests
            </button>
            <button
              onClick={() => setSelectedCategory("3sat")}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap",
                selectedCategory === "3sat"
                  ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              3SAT
            </button>
            <button
              onClick={() => setSelectedCategory("ldpc")}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap",
                selectedCategory === "ldpc"
                  ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              LDPC
            </button>
            <button
              onClick={() => setSelectedCategory("hardware")}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap",
                selectedCategory === "hardware"
                  ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              Hardware
            </button>
          </div>

          {/* Right side: Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <RiSearchLine className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Search tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <div className="flex items-center">
                <select 
                  className="appearance-none rounded-md border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm dark:border-gray-700 dark:bg-gray-800"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  <option>Production</option>
                  <option>Development</option>
                  <option>Testing</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <RiArrowDownSLine className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            <div className="relative flex items-center">
              <RiCalendarLine className="absolute left-3 h-4 w-4 text-gray-400" />
              <select 
                className="appearance-none rounded-md border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm dark:border-gray-700 dark:bg-gray-800"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option>Last 12 hours</option>
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <RiArrowDownSLine className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            
            <Button 
              onClick={() => setIsOpen(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center gap-1.5 text-sm whitespace-nowrap"
              disabled={!isAdmin}
            >
              <RiAddLine className="h-4 w-4" />
              New Test
            </Button>
          </div>
        </div>
        
        {/* Tests Table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm">
          {filteredTests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60">
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Test Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Creator
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Chip Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredTests.map((test) => (
                    <tr key={test.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {test.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={
                              test.createdBy?.photoURL ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${test.createdBy?.name || "User"}`
                            }
                            alt="Creator Avatar"
                            className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 mr-2"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {test.createdBy?.name || "User"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 inline-flex text-xs font-mono leading-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          {test.chipType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                            test.status === "completed"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                              : test.status === "running"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                              : test.status === "failed"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          )}
                        >
                          {test.status === "running" && (
                            <span className="w-1.5 h-1.5 mr-1.5 bg-current rounded-full animate-pulse"></span>
                          )}
                          {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          onClick={() => setSelectedTest(test)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                          variant="ghost"
                        >
                          View details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-gray-400 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <RiSearchLine className="h-6 w-6" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tests found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchQuery 
                  ? `No tests match "${searchQuery}"`
                  : "Try changing your search criteria or create a new test."
                }
              </p>
              {isAdmin && (
                <div className="mt-6">
                  <Button 
                    onClick={() => setIsOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center gap-1.5 text-sm mx-auto"
                  >
                    <RiAddLine className="h-4 w-4" />
                    New Test
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {filteredTests.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing <span className="font-medium">{filteredTests.length}</span> of <span className="font-medium">{tests.length}</span> tests
                </div>
                {filteredTests.length < tests.length && (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCategory("all")}
                    className="text-sm border border-gray-200 px-3 py-1.5 rounded-md text-gray-600 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    View all tests
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-6 right-6 max-w-xs p-4 bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/30 rounded-lg shadow-lg text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-3"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <CreateTestWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onTestComplete={handleCreateTest}
      />
    </div>
  );
}