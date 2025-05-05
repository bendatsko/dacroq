"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Switch } from "@/components/Switch";
import { Label } from "@/components/Label";
import {
  RiUser3Line,
  RiSaveLine,
  RiCheckLine,
  RiMailLine
} from "@remixicon/react";

export default function SettingsPage() {
  const router = useRouter();
  
  // User data
  const [userData, setUserData] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  
  // Settings states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [testCompletionAlerts, setTestCompletionAlerts] = useState(true);
  const [systemUpdates, setSystemUpdates] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState("60");
  const [defaultDashboardView, setDefaultDashboardView] = useState("recent");
  const [defaultDateRange, setDefaultDateRange] = useState("7days");
  
  // Form state management
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setError] = useState<string | null>(null);

  // Load user data and settings
  useEffect(() => {
    // Get user data from localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUserData(parsedUser);
      setUserId(parsedUser.uid);
      
      // Fetch user settings from Firestore
      fetchUserSettings(parsedUser.uid);
    }
  }, []);
  
  const fetchUserSettings = async (uid: string) => {
    try {
      const userSettingsRef = doc(db, "userSettings", uid);
      const userSettingsDoc = await getDoc(userSettingsRef);
      
      if (userSettingsDoc.exists()) {
        const settings = userSettingsDoc.data();
        
        // Update state with fetched settings
        if (settings.notifications) {
          setEmailNotifications(settings.notifications.email ?? true);
          setTestCompletionAlerts(settings.notifications.testCompletion ?? true);
          setSystemUpdates(settings.notifications.systemUpdates ?? true);
        }
        
        if (settings.interface) {
          setAutoRefresh(settings.interface.autoRefresh ?? "60");
          setDefaultDashboardView(settings.interface.defaultView ?? "recent");
          setDefaultDateRange(settings.interface.defaultDateRange ?? "7days");
        }
      }
    } catch (error) {
      console.error("Error fetching user settings:", error);
    }
  };
  
  // Save user settings
  const saveSettings = async () => {
    if (!userId) return;
    
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      const userSettingsRef = doc(db, "userSettings", userId);
      
      await updateDoc(userSettingsRef, {
        notifications: {
          email: emailNotifications,
          testCompletion: testCompletionAlerts,
          systemUpdates: systemUpdates,
        },
        interface: {
          autoRefresh: autoRefresh,
          defaultView: defaultDashboardView,
          defaultDateRange: defaultDateRange,
        },
        updatedAt: new Date(),
      });
      
      setSaveSuccess(true);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setError("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your account preferences and application settings
        </p>
      </div>

      <div className="space-y-6">
        {/* Notification Settings */}
        <div className="mb-8">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Notification Preferences
              </h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Receive email notifications about your account
                    </p>
                  </div>
                  <Switch 
                    checked={emailNotifications} 
                    onChange={() => setEmailNotifications(!emailNotifications)} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Test Completion Alerts</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Receive notifications when your tests complete
                    </p>
                  </div>
                  <Switch 
                    checked={testCompletionAlerts} 
                    onChange={() => setTestCompletionAlerts(!testCompletionAlerts)} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>System Updates</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Receive notifications about system updates and maintenance
                    </p>
                  </div>
                  <Switch 
                    checked={systemUpdates} 
                    onChange={() => setSystemUpdates(!systemUpdates)} 
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Interface Settings */}
        <div className="mb-8">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Interface Preferences
              </h2>

              <div className="space-y-6">
                <div>
                  <Label className="block mb-2">Dashboard Auto-refresh</Label>
                  <select
                    value={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.value)}
                    className="w-full sm:w-[250px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-700 dark:text-gray-300"
                  >
                    <option value="0">Off</option>
                    <option value="30">Every 30 seconds</option>
                    <option value="60">Every minute</option>
                    <option value="300">Every 5 minutes</option>
                    <option value="600">Every 10 minutes</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Choose how often the dashboard refreshes automatically
                  </p>
                </div>

                <div>
                  <Label className="block mb-2">Default Dashboard View</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="recent"
                        name="dashboardView"
                        value="recent"
                        checked={defaultDashboardView === "recent"}
                        onChange={() => setDefaultDashboardView("recent")}
                        className="h-4 w-4 text-blue-600"
                      />
                      <Label htmlFor="recent">Recent Tests</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="favorites"
                        name="dashboardView"
                        value="favorites"
                        checked={defaultDashboardView === "favorites"}
                        onChange={() => setDefaultDashboardView("favorites")}
                        className="h-4 w-4 text-blue-600"
                      />
                      <Label htmlFor="favorites">Favorites</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="starred"
                        name="dashboardView"
                        value="starred"
                        checked={defaultDashboardView === "starred"}
                        onChange={() => setDefaultDashboardView("starred")}
                        className="h-4 w-4 text-blue-600"
                      />
                      <Label htmlFor="starred">Starred Items</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="block mb-2">Default Date Range</Label>
                  <select
                    value={defaultDateRange}
                    onChange={(e) => setDefaultDateRange(e.target.value)}
                    className="w-full sm:w-[250px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-700 dark:text-gray-300"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                    <option value="90days">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Account Settings */}
        <div className="mb-8">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Account Information
              </h2>

              {userData && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    {userData.photoURL ? (
                      <img 
                        src={userData.photoURL} 
                        alt={userData.displayName || "User"} 
                        className="h-16 w-16 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <RiUser3Line className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {userData.displayName || "User"}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {userData.email}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-base font-medium mb-3 text-gray-900 dark:text-white">
                      Connected Applications
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RiMailLine className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">University Email</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{userData.email}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                        Connected
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-4">
        <Button
          variant="secondary"
          onClick={() => router.back()}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          onClick={saveSettings}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>
              <RiSaveLine className="size-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md flex items-center gap-2 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
          <RiCheckLine className="h-5 w-5" />
          <span>Your settings have been saved successfully</span>
        </div>
      )}

      {/* Error Message */}
      {saveError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md flex items-center gap-2 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <span className="text-red-600">×</span>
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}