"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  getDoc,
  serverTimestamp,
  addDoc,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/Switch";
import {
  RiRefreshLine,
  RiUser3Line,
  RiSettings4Line,
  RiAddLine,
  RiMailLine,
  RiErrorWarningLine
} from "@remixicon/react";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: string;
  lastLogin?: any; // Firestore timestamp
  createdAt?: any; // Firestore timestamp
  accountState?: string;
  testsRun?: number;
}

interface WhitelistedEmail {
  email: string;
  addedAt: any; // Firestore timestamp
  addedBy: string;
  status: 'pending' | 'registered' | 'removed';
}

export default function AdminPage() {
  // User Management States
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userMessage, setUserMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [addingEmail, setAddingEmail] = useState(false);
  const [whitelistedEmails, setWhitelistedEmails] = useState<WhitelistedEmail[]>([]);
  const [loadingWhitelist, setLoadingWhitelist] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  
  // System Settings States
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [systemMessage, setSystemMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState("System is currently under maintenance. Only administrators can access the system.");

  useEffect(() => {
    loadUsers();
    loadWhitelistedEmails();
    loadSystemSettings();
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUserMessage(null);
    
    try {
      // Query Firestore for all users
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("lastLogin", "desc"));
      const querySnapshot = await getDocs(q);
      
      const userData: User[] = [];
      querySnapshot.forEach(doc => {
        userData.push({
          uid: doc.id,
          ...doc.data()
        } as User);
      });
      
      setUsers(userData);
    } catch (e) {
      console.error("Error loading users:", e);
      setUserMessage({ type: 'error', text: 'Failed to load users from Firebase' });
    }
    
    setLoadingUsers(false);
  };

  const loadWhitelistedEmails = async () => {
    setLoadingWhitelist(true);
    
    try {
      // Query Firestore for whitelisted emails
      const whitelistRef = collection(db, "whitelisted_emails");
      const q = query(whitelistRef, orderBy("addedAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const emailData: WhitelistedEmail[] = [];
      querySnapshot.forEach(doc => {
        emailData.push({
          email: doc.id,
          ...doc.data()
        } as WhitelistedEmail);
      });
      
      setWhitelistedEmails(emailData);
    } catch (e) {
      console.error("Error loading whitelisted emails:", e);
    }
    
    setLoadingWhitelist(false);
  };

  const addEmailToWhitelist = async () => {
    // Basic validation
    if (!newEmail || !newEmail.includes('@') || !newEmail.includes('.')) {
      setUserMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }
    
    setAddingEmail(true);
    setUserMessage(null);
    
    try {
      // Get current user info from localStorage
      const currentUserStr = localStorage.getItem('user');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : { email: 'admin@example.com' };
      
      // Add email to whitelist collection
      const emailRef = doc(db, "whitelisted_emails", newEmail.toLowerCase());
      await setDoc(emailRef, {
        addedAt: serverTimestamp(),
        addedBy: currentUser.email,
        status: 'pending'
      });
      
      // Refresh the list
      await loadWhitelistedEmails();
      
      // Clear the input
      setNewEmail("");
      setUserMessage({ type: 'success', text: `Email ${newEmail} has been authorized` });
    } catch (e) {
      console.error("Error adding email to whitelist:", e);
      setUserMessage({ type: 'error', text: 'Failed to authorize email' });
    }
    
    setAddingEmail(false);
  };

  const removeFromWhitelist = async (email: string) => {
    try {
      // Actually delete the document from Firestore
      const emailRef = doc(db, "whitelisted_emails", email);
      await deleteDoc(emailRef);
      
      // Refresh the list
      await loadWhitelistedEmails();
      
      setUserMessage({ type: 'success', text: `Email ${email} has been removed from whitelist` });
    } catch (e) {
      console.error("Error removing email from whitelist:", e);
      setUserMessage({ type: 'error', text: 'Failed to remove email from whitelist' });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Update user role in Firestore
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setUsers(users.map(user => 
        user.uid === userId 
          ? { ...user, role: newRole }
          : user
      ));
      
      setUserMessage({ type: 'success', text: `User role updated to ${newRole}` });
    } catch (e) {
      console.error("Error updating user role:", e);
      setUserMessage({ type: 'error', text: 'Failed to update user role' });
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete the user account for ${userEmail}?`)) {
      return;
    }
    
    try {
      // First, remove the user from the users collection
      const userRef = doc(db, "users", userId);
      await deleteDoc(userRef);
      
      // Update local state
      setUsers(users.filter(user => user.uid !== userId));
      
      setUserMessage({ type: 'success', text: `User account for ${userEmail} has been deleted` });
    } catch (e) {
      console.error("Error deleting user:", e);
      setUserMessage({ type: 'error', text: 'Failed to delete user account' });
    }
  };

  const openEditUserDialog = (user: User) => {
    setEditingUser({...user});
    setEditUserDialogOpen(true);
  };

  const saveUserEdits = async () => {
    if (!editingUser) return;
    
    try {
      const userRef = doc(db, "users", editingUser.uid);
      
      // Only update editable fields
      await updateDoc(userRef, {
        displayName: editingUser.displayName,
        accountState: editingUser.accountState || 'active',
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setUsers(users.map(user => 
        user.uid === editingUser.uid 
          ? { ...user, 
              displayName: editingUser.displayName,
              accountState: editingUser.accountState || 'active'
            }
          : user
      ));
      
      setUserMessage({ type: 'success', text: `User ${editingUser.displayName} updated successfully` });
      setEditUserDialogOpen(false);
    } catch (e) {
      console.error("Error updating user:", e);
      setUserMessage({ type: 'error', text: 'Failed to update user' });
    }
  };

  const loadSystemSettings = async () => {
    setLoadingMaintenance(true);
    
    try {
      // Fetch maintenance mode setting from Firestore
      const settingsRef = doc(db, "system", "settings");
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setMaintenanceMode(data.maintenanceMode || false);
        setMaintenanceMessage(data.maintenanceMessage || "System is currently under maintenance. Only administrators can access the system.");
      }
    } catch (e) {
      console.error("Error loading system settings:", e);
      setSystemMessage({ type: 'error', text: 'Failed to load system settings' });
    }
    
    setLoadingMaintenance(false);
  };

  const toggleMaintenanceMode = async (enabled: boolean) => {
    setSavingMaintenance(true);
    setSystemMessage(null);
    
    try {
      // Save maintenance mode setting to Firestore
      const settingsRef = doc(db, "system", "settings");
      await setDoc(settingsRef, {
        maintenanceMode: enabled,
        maintenanceMessage: maintenanceMessage,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      setMaintenanceMode(enabled);
      setSystemMessage({ 
        type: 'success', 
        text: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled' 
      });
    } catch (e) {
      console.error("Error updating maintenance mode:", e);
      setSystemMessage({ type: 'error', text: 'Failed to update maintenance mode' });
    }
    
    setSavingMaintenance(false);
  };

  const updateMaintenanceMessage = async (message: string) => {
    setSavingMaintenance(true);
    setSystemMessage(null);
    
    try {
      // Save maintenance message to Firestore
      const settingsRef = doc(db, "system", "settings");
      await setDoc(settingsRef, {
        maintenanceMessage: message,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      setMaintenanceMessage(message);
      setSystemMessage({ type: 'success', text: 'Maintenance message updated' });
    } catch (e) {
      console.error("Error updating maintenance message:", e);
      setSystemMessage({ type: 'error', text: 'Failed to update maintenance message' });
    }
    
    setSavingMaintenance(false);
  };

  return (
    <main className="max-w-screen-xl mx-auto px-6 pt-8 pb-16 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">
          Admin Controls
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage users and system settings
        </p>
      </header>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <RiUser3Line className="size-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1.5">
            <RiSettings4Line className="size-4" />
            System Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <Card className="p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">
                User Management
              </h2>
              <Button 
                size="sm"
                variant="secondary"
                onClick={() => {
                  loadUsers();
                  loadWhitelistedEmails();
                }}
                disabled={loadingUsers || loadingWhitelist}
                className="flex items-center gap-1.5"
              >
                <RiRefreshLine className={`size-4 ${loadingUsers || loadingWhitelist ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {userMessage && (
              <div className={`mb-4 px-4 py-3 rounded-md text-sm ${
                userMessage.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {userMessage.text}
              </div>
            )}

            {/* Add New User section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
              <h3 className="text-md font-medium text-gray-900 mb-2">
                Authorize New User
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative flex-grow">
                  <RiMailLine className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                  <input 
                    type="email" 
                    value={newEmail} 
                    onChange={(e) => setNewEmail(e.target.value)} 
                    placeholder="Enter email address (any domain)" 
                    className="w-full p-2 pl-10 text-sm text-gray-700 rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <Button 
                  size="sm"
                  variant="secondary"
                  onClick={addEmailToWhitelist}
                  disabled={addingEmail}
                  className="flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RiAddLine className={`size-4 ${addingEmail ? 'animate-spin' : ''}`} />
                  Authorize User
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This will authorize the email address, allowing the user to register and access the system.
              </p>
            </div>

            {/* Combined User Management Table */}
            <div className="space-y-1 mb-4">
              <h3 className="text-md font-medium text-gray-900">
                User Accounts & Authorized Emails
              </h3>
              <p className="text-xs text-gray-500">
                Manage registered users and authorized email addresses
              </p>
            </div>

            {loadingUsers || loadingWhitelist ? (
              <div className="flex justify-center items-center h-32">
                <p className="text-gray-500">Loading user data...</p>
              </div>
            ) : (users.length === 0 && whitelistedEmails.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                No users or authorized emails found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email / User</TableHead>
                      <TableHead>Role / Status</TableHead>
                      <TableHead>Added / Created</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Render Active Users */}
                    {users.map((user) => (
                      <TableRow key={user.uid} className="border-b border-gray-100">
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.displayName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 w-fit">
                              {user.role}
                            </div>
                            <div className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full w-fit ${
                              user.accountState === 'suspended' ? 'bg-amber-100 text-amber-800' :
                              user.accountState === 'inactive' ? 'bg-red-100 text-red-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {user.accountState || 'active'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.createdAt && user.createdAt.toDate
                            ? user.createdAt.toDate().toLocaleDateString()
                            : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {user.lastLogin && user.lastLogin.toDate 
                            ? user.lastLogin.toDate().toLocaleString() 
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm"
                              variant="ghost" 
                              onClick={() => openEditUserDialog(user)}
                              className="h-8"
                            >
                              Edit
                            </Button>
                            <Button 
                              size="sm"
                              variant="ghost" 
                              onClick={() => updateUserRole(user.uid, user.role === 'admin' ? 'user' : 'admin')}
                              className="h-8"
                            >
                              {user.role === 'admin' ? 'Make User' : 'Make Admin'}
                            </Button>
                            {/* Only allow deletion for non-umich users */}
                            {user.email && !user.email.endsWith('@umich.edu') && (
                              <Button 
                                size="sm"
                                variant="ghost" 
                                onClick={() => deleteUser(user.uid, user.email || '')}
                                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Render Authorized Emails that aren't already registered */}
                    {whitelistedEmails
                      .filter(email => !users.some(user => user.email === email.email)) // Only show emails not already registered
                      .map((email) => (
                        <TableRow key={email.email} className="bg-gray-50">
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-600">{email.email}</p>
                              <p className="text-xs text-gray-500">Added by: {email.addedBy}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 w-fit">
                              authorized
                            </div>
                          </TableCell>
                          <TableCell>
                            {email.addedAt && email.addedAt.toDate 
                              ? email.addedAt.toDate().toLocaleString() 
                              : 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-400">Not registered yet</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm"
                                variant="ghost" 
                                onClick={() => removeFromWhitelist(email.email)}
                                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                Revoke Access
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="system">
          <Card className="p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">
                System Settings
              </h2>
              <Button 
                size="sm"
                variant="secondary"
                onClick={loadSystemSettings}
                disabled={loadingMaintenance}
                className="flex items-center gap-1.5"
              >
                <RiRefreshLine className={`size-4 ${loadingMaintenance ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {systemMessage && (
              <div className={`mb-4 px-4 py-3 rounded-md text-sm ${
                systemMessage.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {systemMessage.text}
              </div>
            )}

            {/* Maintenance Mode Section */}
            <div className="space-y-6">
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <RiErrorWarningLine className="text-amber-500 size-5" />
                    <h3 className="text-md font-medium text-gray-900">
                      Maintenance Mode
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 mr-2">
                      {maintenanceMode ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch 
                      checked={maintenanceMode} 
                      onCheckedChange={toggleMaintenanceMode}
                      disabled={savingMaintenance}
                    />
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  When maintenance mode is enabled, only administrators can log in to the system. All other users will see a maintenance message.
                </p>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Maintenance Message
                  </label>
                  <textarea 
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    className="w-full h-24 p-3 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter maintenance message..."
                  />
                  <Button
                    size="sm"
                    onClick={() => updateMaintenanceMessage(maintenanceMessage)}
                    disabled={savingMaintenance}
                    className="mt-2"
                  >
                    Update Message
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Edit User Dialog */}
      {editUserDialogOpen && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit User
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input 
                  type="text" 
                  value={editingUser.displayName || ''} 
                  onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})} 
                  className="w-full p-2 text-sm text-gray-700 rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input 
                  type="text" 
                  value={editingUser.email || ''} 
                  disabled
                  className="w-full p-2 text-sm text-gray-700 rounded-md border border-gray-200 bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Status
                </label>
                <select
                  value={editingUser.accountState || 'active'}
                  onChange={(e) => setEditingUser({...editingUser, accountState: e.target.value})}
                  className="w-full p-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setEditUserDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={saveUserEdits}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
