"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-utils";
import { auth, User } from "@/lib/auth";
import {
  RiUser3Line,
  RiShieldLine,
  RiNotificationLine,
  RiFileCopyLine,
  RiDeleteBin5Line,
  RiCheckLine,
  RiAlertLine,
  RiGoogleLine,
  RiLockLine,
  RiMailLine,
  RiSettings3Line,
  RiCloseLine,
  RiCalendarLine,
  RiTimeLine,
  RiHashtag,
  RiDownloadLine,
  RiMore2Line,
  RiKeyLine,
  RiAddLine
} from "@remixicon/react";

interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  expires_at: string;
  created_at: string;
  created_by: string;
  active: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  last_used?: string;
  expires?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  
  // User data
  const [userData, setUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // User statistics and management
  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Announcement system
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'error' | 'success'>('info');
  const [announcementExpiry, setAnnouncementExpiry] = useState("");
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  
  // Maintenance mode
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isUpdatingMaintenance, setIsUpdatingMaintenance] = useState(false);
  
  // Form state management
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // API Key management
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Function to fetch user statistics
  const fetchUserStats = async () => {
    if (!isAdmin) return;
    
    setIsLoadingStats(true);
    try {
      const stats = await auth.getUserStats();
      setUserStats(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      toast({
        title: "Error",
        description: "Failed to load user statistics",
        variant: "destructive"
      });
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Function to fetch all users for management
  const fetchUsers = async () => {
    if (!isAdmin) return;
    
    setIsLoadingUsers(true);
    try {
      const usersList = await auth.getUsers();
      
      // Sort by creation date (newest first)
      usersList.sort((a, b) => {
        const dateA = new Date(a.created || 0);
        const dateB = new Date(b.created || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Function to update user role
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await auth.updateUserRole(userId, newRole);
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      toast({
        title: "Success",
        description: `User role updated to ${newRole}`,
        variant: "success"
      });
      
      // Refresh stats
      fetchUserStats();
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive"
      });
    }
  };

  // Function to delete user
  const deleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }
    
    try {
      await auth.deleteUser(userId);
      
      // Update local state
      setUsers(users.filter(user => user.id !== userId));
      
      toast({
        title: "Success",
        description: "User deleted successfully",
        variant: "success"
      });
      
      // Refresh stats
      fetchUserStats();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      });
    }
  };

  // Function to create announcement
  const createAnnouncement = async () => {
    if (!announcementMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter an announcement message",
        variant: "destructive"
      });
      return;
    }
    
    if (!announcementExpiry) {
      toast({
        title: "Error",
        description: "Please select an expiration date and time",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreatingAnnouncement(true);
    try {
      const expiryDate = new Date(announcementExpiry);
      const now = new Date();
      
      if (expiryDate <= now) {
        toast({
          title: "Error",
          description: "Expiration date must be in the future",
          variant: "destructive"
        });
        return;
      }
      
      await auth.createAnnouncement({
        message: announcementMessage,
        type: announcementType,
        expires_at: expiryDate.toISOString()
      });
      
      toast({
        title: "Success",
        description: "Announcement created successfully",
        variant: "success"
      });
      
      // Reset form
      setAnnouncementMessage("");
      setAnnouncementType('info');
      setAnnouncementExpiry("");
      setShowAnnouncementModal(false);
      
    } catch (error) {
      console.error("Error creating announcement:", error);
      toast({
        title: "Error",
        description: "Failed to create announcement",
        variant: "destructive"
      });
    } finally {
      setIsCreatingAnnouncement(false);
    }
  };

  // Function to toggle maintenance mode
  const toggleMaintenanceMode = async (enabled: boolean) => {
    setIsUpdatingMaintenance(true);
    try {
      await auth.updateSystemSettings({ 
        maintenanceMode: enabled.toString(),
        maintenanceMessage: "System is currently under maintenance. Please check back later."
      });
      
      setMaintenanceMode(enabled);
      
      toast({
        title: enabled ? "Maintenance Mode Enabled" : "Maintenance Mode Disabled",
        description: enabled 
          ? "All users have been logged out and login is disabled"
          : "Users can now log in normally",
        variant: "success"
      });
      
    } catch (error) {
      console.error("Error updating maintenance mode:", error);
      toast({
        title: "Error",
        description: "Failed to update maintenance mode",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingMaintenance(false);
    }
  };

  // API Key management functions
  const fetchApiKeys = async () => {
    setIsLoadingApiKeys(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${userData?.id}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive"
      });
    } finally {
      setIsLoadingApiKeys(false);
    }
  };

  const createApiKey = async () => {
    if (!newApiKeyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the API key",
        variant: "destructive"
      });
      return;
    }

    setIsCreatingApiKey(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData?.id}`,
        },
        body: JSON.stringify({ name: newApiKeyName }),
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const data = await response.json();
      setNewlyCreatedKey(data.key);
      setApiKeys([...apiKeys, data.apiKey]);
      
      toast({
        title: "Success",
        description: "API key created successfully",
        variant: "success"
      });

      setNewApiKeyName("");
    } catch (error) {
      console.error("Error creating API key:", error);
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive"
      });
    } finally {
      setIsCreatingApiKey(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (!window.confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userData?.id}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      setApiKeys(apiKeys.filter(key => key.id !== keyId));
      
      toast({
        title: "Success",
        description: "API key deleted successfully",
        variant: "success"
      });
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive"
      });
    }
  };

  // Load user data and settings
  useEffect(() => {
    const loadUserData = () => {
      try {
        const currentUser = auth.getCurrentUser();
        if (currentUser) {
          setUserData(currentUser);
          setIsAdmin(currentUser.role === "admin");
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Set up auth state listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserData(user);
        setIsAdmin(user.role === "admin");
      }
      setIsLoading(false);
    });

    loadUserData();

    return () => unsubscribe();
  }, []);

  // Fetch user stats when admin status is determined
  useEffect(() => {
    if (isAdmin && !isLoading) {
      fetchUserStats();
    }
  }, [isAdmin, isLoading]);

  // Fetch API keys when user data is loaded
  useEffect(() => {
    if (userData && !isLoading) {
      fetchApiKeys();
    }
  }, [userData, isLoading]);

  // Save settings
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaveSuccess(true);
      toast({
        title: "Success",
        description: "Settings saved successfully",
        variant: "success"
      });
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, successMessage: string = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: successMessage,
        variant: "success"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  // Format date helper
  const formatDate = (date: any) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#1d1d1f]">Settings</h1>
        <p className="text-[#86868b] mt-1">Manage your account information and preferences</p>
      </div>

      {/* Account Information - Most Important */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiUser3Line className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Your account details and authentication information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {userData && (
            <div className="space-y-6">
              {/* Main user info - clean and simple */}
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold text-[#1d1d1f]">
                      {userData.name || "User"}
                    </h3>
                    <p className="text-[#86868b] flex items-center gap-2">
                      <RiMailLine className="h-4 w-4" />
                      {userData.email}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {userData.role === "admin" && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                        <RiShieldLine className="h-3 w-3 mr-1" />
                        Administrator
                      </Badge>
                    )}
                  </div>
                </div>

                {/* More options menu */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <RiMore2Line className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Account Details</DialogTitle>
                      <DialogDescription>
                        Additional account information and identifiers
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">User ID</Label>
                        <div className="flex items-center space-x-2">
                          <Input 
                            value={userData?.id || "N/A"} 
                            readOnly 
                            className="bg-[#f5f5f7] text-[#86868b] font-mono text-xs"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => copyToClipboard(userData?.id || "")}
                          >
                            <RiFileCopyLine className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Account Created</Label>
                        <div className="text-sm text-[#86868b] p-2 bg-[#f5f5f7] rounded">
                          {userData.created ? formatDate(userData.created) : "Unknown"}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Last Login</Label>
                        <div className="text-sm text-[#86868b] p-2 bg-[#f5f5f7] rounded">
                          {userData.last_login ? formatDate(userData.last_login) : "Unknown"}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* API Keys Section */}
              <div className="border-t border-[#d2d2d7] pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-[#1d1d1f]">API Keys</h4>
                    <p className="text-sm text-[#86868b]">Manage API keys for programmatic access</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKeyModal(true)}
                  >
                    <RiAddLine className="h-4 w-4 mr-2" />
                    Create Key
                  </Button>
                </div>

                {isLoadingApiKeys ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                  </div>
                ) : apiKeys.length === 0 ? (
                  <div className="text-center py-8 border border-[#d2d2d7] rounded-lg bg-[#f5f5f7]">
                    <RiKeyLine className="h-8 w-8 text-[#86868b] mx-auto mb-2" />
                    <p className="text-sm text-[#86868b]">No API keys created yet</p>
                    <p className="text-xs text-[#86868b] mt-1">Create an API key to access the API programmatically</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((apiKey) => (
                      <div key={apiKey.id} className="flex items-center justify-between p-3 border border-[#d2d2d7] rounded-lg">
                        <div className="flex items-center gap-3">
                          <RiKeyLine className="h-4 w-4 text-[#86868b]" />
                          <div>
                            <div className="font-medium text-[#1d1d1f]">{apiKey.name}</div>
                            <div className="text-xs text-[#86868b]">
                              Created {new Date(apiKey.created).toLocaleDateString()}
                              {apiKey.last_used && ` • Last used ${new Date(apiKey.last_used).toLocaleDateString()}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(apiKey.key, "API key copied to clipboard")}
                          >
                            <RiFileCopyLine className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteApiKey(apiKey.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <RiDeleteBin5Line className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Preferences - Second Most Important */}


      {/* Admin Section - Only visible to admins */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiShieldLine className="h-5 w-5" />
              Administration
            </CardTitle>
            <CardDescription>
              System administration and user management controls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Management */}
            <div className="space-y-4">
              <h4 className="font-medium text-[#1d1d1f]">User Management</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-[#f5f5f7] rounded-lg">
                  <div className="text-2xl font-bold text-[#1d1d1f]">{userStats.totalUsers}</div>
                  <div className="text-sm text-[#86868b]">Total Users</div>
                </div>
                <div className="text-center p-4 bg-[#f5f5f7] rounded-lg">
                  <div className="text-2xl font-bold text-[#1d1d1f]">{userStats.activeUsers}</div>
                  <div className="text-sm text-[#86868b]">Active Users</div>
                </div>
                <div className="text-center p-4 bg-[#f5f5f7] rounded-lg">
                  <div className="text-2xl font-bold text-[#1d1d1f]">{userStats.adminUsers}</div>
                  <div className="text-sm text-[#86868b]">Admins</div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    fetchUsers();
                    setShowUserModal(true);
                  }}
                >
                  <RiUser3Line className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowAnnouncementModal(true)}
                >
                  <RiNotificationLine className="h-4 w-4 mr-2" />
                  Send Announcements
                </Button>
              </div>
            </div>

            <div className="border-t border-[#d2d2d7] my-4"></div>

            {/* System Settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-[#1d1d1f]">System Settings</h4>
              
              <div className="flex items-center justify-between p-4 border border-[#d2d2d7] rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Maintenance Mode</Label>
                  <p className="text-sm text-[#86868b]">
                    Temporarily disable user access for maintenance
                  </p>
                  {maintenanceMode && (
                    <p className="text-sm text-orange-600 font-medium">
                      ⚠️ Maintenance mode is currently active
                    </p>
                  )}
                </div>
                <Switch
                  checked={maintenanceMode}
                  onCheckedChange={toggleMaintenanceMode}
                  disabled={isUpdatingMaintenance}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Management Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Users</DialogTitle>
            <DialogDescription>
              View and manage all registered users
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-[#86868b]">
                Total: {users.length} users
              </div>
              
              <div className="border border-[#d2d2d7] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#f5f5f7]">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#1d1d1f]">User</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#1d1d1f]">Role</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#1d1d1f]">Last Login</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#1d1d1f]">Created</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[#1d1d1f]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d2d2d7]">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-[#f5f5f7]">
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-full bg-[#d2d2d7] flex items-center justify-center">
                                <RiUser3Line className="h-4 w-4 text-[#86868b]" />
                              </div>
                              <div>
                                <div className="font-medium text-[#1d1d1f]">{user.name}</div>
                                <div className="text-sm text-[#86868b]">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={user.role}
                              onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#86868b]">
                            {formatDate(user.last_login)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#86868b]">
                            {formatDate(user.created)}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteUser(user.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <RiDeleteBin5Line className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Announcement Modal */}
      <Dialog open={showAnnouncementModal} onOpenChange={setShowAnnouncementModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
            <DialogDescription>
              Create a banner announcement that will be displayed to all users
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcement-message">Message</Label>
              <Textarea
                id="announcement-message"
                placeholder="Enter your announcement message..."
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="announcement-type">Type</Label>
                <Select value={announcementType} onValueChange={(value: any) => setAnnouncementType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Blue)</SelectItem>
                    <SelectItem value="warning">Warning (Orange)</SelectItem>
                    <SelectItem value="error">Error (Red)</SelectItem>
                    <SelectItem value="success">Success (Green)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="announcement-expiry">Expires At</Label>
                <Input
                  id="announcement-expiry"
                  type="datetime-local"
                  value={announcementExpiry}
                  onChange={(e) => setAnnouncementExpiry(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>
            
            {/* Preview */}
            {announcementMessage && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className={`p-3 rounded-lg border ${
                  announcementType === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                  announcementType === 'warning' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                  announcementType === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                  'bg-green-50 border-green-200 text-green-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{announcementMessage}</span>
                    <RiCloseLine className="h-4 w-4 opacity-50" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAnnouncementModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createAnnouncement} 
              disabled={isCreatingAnnouncement || !announcementMessage.trim() || !announcementExpiry}
            >
              {isCreatingAnnouncement ? (
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
              ) : (
                <RiNotificationLine className="h-4 w-4 mr-2" />
              )}
              Create Announcement
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* API Key Creation Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access to your account
            </DialogDescription>
          </DialogHeader>
          
          {newlyCreatedKey ? (
            <div className="space-y-4">
              <Alert>
                <RiCheckLine className="h-4 w-4" />
                <AlertDescription>
                  API key created successfully! Make sure to copy it now - you won't be able to see it again.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Your new API key</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    value={newlyCreatedKey} 
                    readOnly 
                    className="bg-[#f5f5f7] text-[#86868b] font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(newlyCreatedKey, "API key copied to clipboard")}
                  >
                    <RiFileCopyLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => {
                  setShowApiKeyModal(false);
                  setNewlyCreatedKey(null);
                }}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key-name">API Key Name</Label>
                <Input
                  id="api-key-name"
                  placeholder="e.g., My App Integration"
                  value={newApiKeyName}
                  onChange={(e) => setNewApiKeyName(e.target.value)}
                />
                <p className="text-xs text-[#86868b]">
                  Choose a descriptive name to help you identify this key later
                </p>
              </div>
              
              <Alert>
                <RiAlertLine className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  API keys provide full access to your account. Keep them secure and never share them publicly.
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowApiKeyModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={createApiKey} 
                  disabled={isCreatingApiKey || !newApiKeyName.trim()}
                >
                  {isCreatingApiKey ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
                  ) : (
                    <RiKeyLine className="h-4 w-4 mr-2" />
                  )}
                  Create API Key
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={saveSettings} disabled={isSaving}>
          {isSaving ? (
            <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
          ) : (
            <RiCheckLine className="h-4 w-4 mr-2" />
          )}
          {saveSuccess ? "Saved!" : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}