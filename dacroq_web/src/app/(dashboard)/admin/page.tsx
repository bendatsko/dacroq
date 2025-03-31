"use client";
import { useState, useEffect } from "react";
import {
  RiInformationLine,
  RiRefreshLine,
  RiShieldLine,
  RiAddLine,
  RiCloseLine,
  RiSearchLine,
  RiNotification2Line,
  RiUserAddLine,
  RiUserSettingsLine,
  RiTerminalBoxLine,
  RiSettings4Line,
  RiDashboardLine,
} from "@remixicon/react";
import { Button } from "@/components/Button";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Card,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Badge,
  Select,
  SelectItem,
  TextInput,
  Textarea,
  Dialog,
  DialogPanel,
  Divider,
  Grid,
  Col,
  Flex,
  Title,
  Text,
  Metric,
} from "@tremor/react";

// Interfaces
interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  joinDate: string;
  lastOnlineDate: string | null;
  testsRun: number;
  accountState: "enabled" | "disabled";
  role: "user" | "moderator" | "admin";
  photoURL?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  date: any;
  type: "system" | "alert" | "update" | "info";
  global: boolean;
  forUsers?: string[];
  readBy: string[];
  createdBy: string;
  createdByName: string;
}

// Utility functions
function formatDate(date) {
  if (!date) return "Unknown";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleString();
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Terminal Component
function Terminal({ framework, title }) {
  return (
    <Card className="h-full">
      <Flex alignItems="center" justifyContent="between" className="mb-4">
        <Title>{title}</Title>
        <Button variant="outline" size="sm" className="flex items-center gap-1">
          <RiRefreshLine className="size-4" /> Refresh
        </Button>
      </Flex>
      <div className="bg-gray-900 text-gray-200 p-3 rounded-md h-40 overflow-auto font-mono text-sm">
        <div>$ {framework} --version</div>
        <div className="text-green-400">v16.0.0</div>
        <div>$ {framework} run test</div>
        <div className="text-gray-400">Running tests...</div>
        <div className="text-green-400">✓ All tests passed!</div>
        <div>$ _</div>
      </div>
    </Card>
  );
}

// TestBench Configuration Component
function TestBenchConfig() {
  return (
    <Card>
      <Title>Test Bench Configuration</Title>
      <Divider className="my-4" />
      <div className="space-y-4">
        <div>
          <Text className="font-medium mb-1">Environment</Text>
          <Select defaultValue="staging">
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </Select>
        </div>
        <div>
          <Text className="font-medium mb-1">Test Suite</Text>
          <Select defaultValue="all">
            <SelectItem value="all">All Tests</SelectItem>
            <SelectItem value="unit">Unit Tests</SelectItem>
            <SelectItem value="integration">Integration Tests</SelectItem>
            <SelectItem value="e2e">End-to-End Tests</SelectItem>
          </Select>
        </div>
        <Flex justifyContent="end" className="mt-4">
          <Button className="flex items-center gap-1">
            Run Tests <RiRefreshLine className="size-4" />
          </Button>
        </Flex>
      </div>
    </Card>
  );
}

export default function AdminPanel() {
  // Main state
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rowSelection, setRowSelection] = useState({});

  // Maintenance mode state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [whitelistedEmails, setWhitelistedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");

  // User management state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: "",
    email: "",
    role: "user",
  });

  // Announcement state
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newType, setNewType] = useState("info");
  const [isGlobal, setIsGlobal] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Initial data loading
  useEffect(() => {
    loadUsers();
    loadMaintenanceState();
    loadNotifications();
  }, []);

  // Load maintenance state from Firestore
  const loadMaintenanceState = async () => {
    try {
      const maintenanceRef = doc(db, "system", "maintenance");
      const maintenanceDoc = await getDoc(maintenanceRef);
      if (maintenanceDoc.exists()) {
        setMaintenanceMode(maintenanceDoc.data().enabled);
        setWhitelistedEmails(maintenanceDoc.data().whitelistedEmails || []);
      }
    } catch (error) {
      console.error("Error loading maintenance state:", error);
      setError("Failed to load maintenance settings");
    }
  };

  // Load users from Firestore
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const firestoreUsers = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        firestoreUsers.push({
          uid: doc.id,
          displayName: data.displayName || "Unknown User",
          email: data.email || "",
          joinDate: data.createdAt || new Date().toISOString(),
          lastOnlineDate: data.lastLogin || null,
          testsRun: data.testsRun || 0,
          accountState: data.accountState || "enabled",
          role: data.role || "user",
          photoURL: data.photoURL,
        });
      });
      setUsers(firestoreUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      setError("Error loading user data.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle maintenance mode in Firestore
  const toggleMaintenanceMode = async () => {
    try {
      const maintenanceRef = doc(db, "system", "maintenance");
      await setDoc(maintenanceRef, {
        enabled: !maintenanceMode,
        whitelistedEmails,
        lastUpdated: new Date().toISOString(),
      });
      setMaintenanceMode(!maintenanceMode);
      setError(null);
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      setError("Failed to toggle maintenance mode");
    }
  };

  // Load notifications from Firestore
  const loadNotifications = async () => {
    try {
      const notificationsRef = collection(db, "notifications");
      const notificationsQuery = query(
        notificationsRef,
        where("deleted", "!=", true),
        orderBy("date", "desc")
      );

      const notificationsSnapshot = await getDocs(notificationsQuery);
      const notificationsData = notificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setNotifications(notificationsData);
    } catch (error) {
      console.error("Error loading notifications:", error);
      setError("Failed to load notifications");
    }
  };

  // Add new user to Firestore
  const handleAddUser = async (e) => {
    e.preventDefault();

    try {
      // Here you would typically use Firebase Authentication createUser
      // For demo purposes, we're just adding to Firestore
      const userRef = collection(db, "users");
      await addDoc(userRef, {
        displayName: newUser.displayName,
        email: newUser.email,
        role: newUser.role,
        accountState: "enabled",
        createdAt: new Date().toISOString(),
        testsRun: 0
      });

      // Reset form and close modal
      setNewUser({
        displayName: "",
        email: "",
        role: "user",
      });
      setIsUserModalOpen(false);

      // Reload users
      loadUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      setError("Failed to add user");
    }
  };

  // Create a new notification announcement
  const handleCreateNotification = async (e) => {
    e.preventDefault();

    try {
      // Get current user from localStorage
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        setError("User not authenticated");
        return;
      }

      const user = JSON.parse(userStr);

      // Basic validation
      if (!newTitle.trim() || !newMessage.trim()) {
        setError("Title and message are required");
        return;
      }

      // Create notification object
      const newNotification = {
        title: newTitle,
        message: newMessage,
        type: newType,
        date: serverTimestamp(),
        global: isGlobal,
        forUsers: isGlobal ? [] : selectedUsers,
        readBy: [],
        createdBy: user.uid,
        createdByName: user.displayName || user.name || "Admin",
        deleted: false,
      };

      // Add to Firestore
      await addDoc(collection(db, "notifications"), newNotification);

      // Reset form fields and close modal
      setNewTitle("");
      setNewMessage("");
      setNewType("info");
      setIsGlobal(true);
      setSelectedUsers([]);
      setIsNotificationModalOpen(false);
      setError(null);

      // Reload notifications
      loadNotifications();
    } catch (error) {
      console.error("Error creating notification:", error);
      setError("Failed to create notification");
    }
  };

  // Handle delete notification
  const handleDeleteNotification = async (id) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;

    try {
      await updateDoc(doc(db, "notifications", id), {
        deleted: true,
        deletedAt: serverTimestamp(),
      });
      loadNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
      setError("Failed to delete notification");
    }
  };

  // Handle user status change
  const handleUserStatusChange = async (user, newStatus) => {
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { accountState: newStatus });
      loadUsers();
    } catch (error) {
      console.error("Error updating user status:", error);
      setError("Failed to update user status");
    }
  };

  // Handle user role change
  const handleUserRoleChange = async (user, newRole) => {
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { role: newRole });
      loadUsers();
    } catch (error) {
      console.error("Error updating user role:", error);
      setError("Failed to update user role");
    }
  };

  // Filter notifications by search query
  const filteredNotifications = searchQuery.trim() === ""
    ? notifications
    : notifications.filter((notification) => {
      const query = searchQuery.toLowerCase();
      return (
        (notification.title && notification.title.toLowerCase().includes(query)) ||
        (notification.message && notification.message.toLowerCase().includes(query)) ||
        (notification.type && notification.type.toLowerCase().includes(query))
      );
    });

  return (
    <main className="p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Admin Panel</h1>
          <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500">
            Manage users, announcements, and system status
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={maintenanceMode ? "destructive" : "secondary"}
            onClick={toggleMaintenanceMode}
            className="flex items-center gap-2"
          >
            <RiShieldLine className="size-4" />
            {maintenanceMode ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              loadUsers();
              loadNotifications();
            }}
            className="flex items-center gap-1"
          >
            <RiRefreshLine className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="my-4 flex items-center gap-2 rounded-md bg-amber-50 p-4 text-amber-800 dark:bg-amber-900/10 dark:text-amber-500">
          <RiInformationLine className="size-4" />
          <p>{error}</p>
        </div>
      )}

      {maintenanceMode && (
        <Card className="mb-6">
          <Flex alignItems="center" justifyContent="between" className="mb-4">
            <Title>Maintenance Mode Active</Title>
            <Badge color="amber">Restricted Access</Badge>
          </Flex>
          <Text>Only whitelisted emails can access the system while maintenance mode is active.</Text>

          <Divider className="my-4" />

          <div className="mt-2 flex gap-2">
            <TextInput
              type="email"
              placeholder="Add email to whitelist"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1"
            />
            <Button variant="secondary" onClick={() => {
              if (newEmail && !whitelistedEmails.includes(newEmail)) {
                setWhitelistedEmails([...whitelistedEmails, newEmail]);
                setNewEmail("");
              }
            }}>
              Add Email
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {whitelistedEmails.map((email) => (
              <div
                key={email}
                className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
              >
                {email}
                <button
                  onClick={() => setWhitelistedEmails(whitelistedEmails.filter(e => e !== email))}
                  className="text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6 mb-6">
        {/* User Management Card */}
        <Card className="col-span-1">
          <Flex alignItems="center" justifyContent="between" className="mb-4">
            <div>
              <Title>User Management</Title>
              <Text>Total Users: {users.length}</Text>
            </div>
            <Button onClick={() => setIsUserModalOpen(true)} className="flex items-center gap-1">
              <RiUserAddLine className="size-4" />
              Add User
            </Button>
          </Flex>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium text-gray-500 dark:text-gray-400 border-b pb-2">
              <span>User Role</span>
              <span>Count</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Badge color="blue">Admin</Badge>
                <span>Administrators</span>
              </span>
              <span className="font-medium">{users.filter(u => u.role === 'admin').length}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Badge color="indigo">Mod</Badge>
                <span>Moderators</span>
              </span>
              <span className="font-medium">{users.filter(u => u.role === 'moderator').length}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Badge color="gray">User</Badge>
                <span>Standard Users</span>
              </span>
              <span className="font-medium">{users.filter(u => u.role === 'user').length}</span>
            </div>
          </div>

          <Divider className="my-4" />

          <Flex justifyContent="end">
            <Button variant="secondary" onClick={() => setActiveTab(0)} className="flex items-center gap-1">
              <RiUserSettingsLine className="size-4" />
              Manage Users
            </Button>
          </Flex>
        </Card>

        {/* Announcement Tool Card */}
        <Card className="col-span-1">
          <Flex alignItems="center" justifyContent="between" className="mb-4">
            <div>
              <Title>Announcement Tool</Title>
              <Text>Total Announcements: {notifications.length}</Text>
            </div>
            <Button onClick={() => setIsNotificationModalOpen(true)} className="flex items-center gap-1">
              <RiNotification2Line className="size-4" />
              Create
            </Button>
          </Flex>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium text-gray-500 dark:text-gray-400 border-b pb-2">
              <span>Type</span>
              <span>Count</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Badge color="amber">Alert</Badge>
                <span>Alert Messages</span>
              </span>
              <span className="font-medium">{notifications.filter(n => n.type === 'alert').length}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Badge color="green">Update</Badge>
                <span>Update Messages</span>
              </span>
              <span className="font-medium">{notifications.filter(n => n.type === 'update').length}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Badge color="blue">System</Badge>
                <span>System Messages</span>
              </span>
              <span className="font-medium">{notifications.filter(n => n.type === 'system').length}</span>
            </div>
          </div>

          <Divider className="my-4" />

          <Flex justifyContent="end">
            <Button variant="secondary" onClick={() => setActiveTab(1)} className="flex items-center gap-1">
              <RiNotification2Line className="size-4" />
              Manage Announcements
            </Button>
          </Flex>
        </Card>

        {/* Test Bench Card */}
        <Card className="col-span-1">
          <Flex alignItems="center" justifyContent="between" className="mb-4">
            <div>
              <Title>Test Bench</Title>
              <Text>Run tests across frameworks</Text>
            </div>
            <Button variant="secondary" className="flex items-center gap-1">
              <RiSettings4Line className="size-4" />
              Configure
            </Button>
          </Flex>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium text-gray-500 dark:text-gray-400 border-b pb-2">
              <span>Framework</span>
              <span>Status</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span>React</span>
              </span>
              <Badge color="green">Ready</Badge>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span>Node.js</span>
              </span>
              <Badge color="green">Ready</Badge>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span>Firebase</span>
              </span>
              <Badge color="green">Ready</Badge>
            </div>
          </div>

          <Divider className="my-4" />

          <Flex justifyContent="end">
            <Button variant="secondary" onClick={() => setActiveTab(2)} className="flex items-center gap-1">
              <RiTerminalBoxLine className="size-4" />
              Open Test Bench
            </Button>
          </Flex>
        </Card>
      </Grid>

      <TabGroup index={activeTab} onIndexChange={setActiveTab}>
        <TabList className="mb-6">
          <Tab icon={RiUserSettingsLine}>Users</Tab>
          <Tab icon={RiNotification2Line}>Announcements</Tab>
          <Tab icon={RiTerminalBoxLine}>Test Bench</Tab>
        </TabList>

        <TabPanels>
          {/* USERS TAB */}
          <TabPanel>
            <section className="mb-6">
              {loading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900/10 border-t-gray-900 dark:border-gray-50/10 dark:border-t-gray-50"></div>
                </div>
              ) : (
                <Card>
                  <Title>User List</Title>
                  <Divider className="my-4" />
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Name</TableHeaderCell>
                          <TableHeaderCell>Email</TableHeaderCell>
                          <TableHeaderCell>Last Online</TableHeaderCell>
                          <TableHeaderCell>Status</TableHeaderCell>
                          <TableHeaderCell>Role</TableHeaderCell>
                          <TableHeaderCell>Actions</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.uid}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {user.photoURL ? (
                                  <img
                                    src={user.photoURL}
                                    alt={user.displayName}
                                    className="size-8 rounded-full border border-gray-300 dark:border-gray-800"
                                  />
                                ) : (
                                  <div className="flex size-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                    {user.displayName.charAt(0)}
                                  </div>
                                )}
                                <span>{user.displayName}</span>
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              {user.lastOnlineDate ? (
                                new Date(user.lastOnlineDate).toLocaleDateString()
                              ) : (
                                "Never"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge color={user.accountState === "enabled" ? "green" : "red"}>
                                {user.accountState === "enabled" ? "Enabled" : "Disabled"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.role}
                                onValueChange={(value) => handleUserRoleChange(user, value)}
                              >
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="moderator">Moderator</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant={user.accountState === "enabled" ? "destructive" : "secondary"}
                                size="xs"
                                onClick={() => handleUserStatusChange(
                                  user,
                                  user.accountState === "enabled" ? "disabled" : "enabled"
                                )}
                              >
                                {user.accountState === "enabled" ? "Disable" : "Enable"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </section>
          </TabPanel>

          {/* ANNOUNCEMENTS TAB */}
          <TabPanel>
            <section className="mb-6">
              <Card>
                <Flex alignItems="center" justifyContent="between" className="mb-4">
                  <Title>System Announcements</Title>
                  <Button onClick={() => setIsNotificationModalOpen(true)} className="flex items-center gap-1">
                    <RiNotification2Line className="size-4" />
                    Create Announcement
                  </Button>
                </Flex>

                <div className="mb-4 relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <RiSearchLine className="size-4 text-gray-400" />
                  </div>
                  <TextInput
                    placeholder="Search announcements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Divider className="my-4" />

                {filteredNotifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <RiNotification2Line className="mx-auto size-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No announcements</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Get started by creating a new system announcement.
                    </p>
                    <div className="mt-6">
                      <Button onClick={() => setIsNotificationModalOpen(true)}>
                        <RiAddLine className="mr-2 size-4" />
                        New Announcement
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Title</TableHeaderCell>
                          <TableHeaderCell>Type</TableHeaderCell>
                          <TableHeaderCell>Audience</TableHeaderCell>
                          <TableHeaderCell>Date</TableHeaderCell>
                          <TableHeaderCell>Created By</TableHeaderCell>
                          <TableHeaderCell>Actions</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredNotifications.map((notification) => (
                          <TableRow key={notification.id}>
                            <TableCell>
                              <div className="font-medium">{notification.title}</div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                color={
                                  notification.type === "alert"
                                    ? "amber"
                                    : notification.type === "update"
                                      ? "green"
                                      : notification.type === "system"
                                        ? "blue"
                                        : "gray"
                                }
                              >
                                {notification.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {notification.global ? (
                                <Badge color="blue">All Users</Badge>
                              ) : (
                                <Badge color="indigo">Targeted</Badge>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(notification.date)}</TableCell>
                            <TableCell>{notification.createdByName || "Unknown"}</TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="xs"
                                onClick={() => handleDeleteNotification(notification.id)}
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </section>
          </TabPanel>

          {/* TEST BENCH TAB */}
          <TabPanel>
            <Grid numItems={1} numItemsMd={2} className="gap-6 mb-6">
              <Col numColSpan={1} numColSpanMd={2}>
                <TestBenchConfig />
              </Col>

              <Terminal framework="react" title="React Terminal" />
              <Terminal framework="node" title="Node.js Terminal" />
              <Terminal framework="firebase" title="Firebase Terminal" />
            </Grid>
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Create Announcement Modal */}
      <Dialog
        open={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        static={true}
      >
        <DialogPanel>
          <div className="flex justify-between items-center border-b p-4">
            <Title>Create New Announcement</Title>
            <button onClick={() => setIsNotificationModalOpen(false)}>
              <RiCloseLine className="size-5" />
            </button>
          </div>

          <form onSubmit={handleCreateNotification} className="p-4">
            <div className="space-y-4">
              <div>
                <Text className="font-medium mb-1">Title</Text>
                <TextInput
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Announcement title"
                  required
                />
              </div>

              <div>
                <Text className="font-medium mb-1">Type</Text>
                <Select value={newType} onValueChange={(value) => setNewType(value)}>
                  <SelectItem value="info">Information</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </Select>
              </div>

              <div>
                <Text className="font-medium mb-1">Message</Text>
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Announcement message"
                  rows={4}
                  required
                />
              </div>

              <div>
                <Text className="font-medium mb-1">Audience</Text>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="audienceGlobal"
                      name="audience"
                      className="h-4 w-4 text-blue-600"
                      checked={isGlobal}
                      onChange={() => setIsGlobal(true)}
                    />
                    <label htmlFor="audienceGlobal" className="ml-2 text-sm">
                      All users
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="audienceSpecific"
                      name="audience"
                      className="h-4 w-4 text-blue-600"
                      checked={!isGlobal}
                      onChange={() => setIsGlobal(false)}
                    />
                    <label htmlFor="audienceSpecific" className="ml-2 text-sm">
                      Specific users
                    </label>
                  </div>
                </div>
              </div>

              {!isGlobal && (
                <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                  <Text className="font-medium mb-2">
                    Select users ({selectedUsers.length} selected)
                  </Text>
                  <ul className="space-y-2">
                    {users.map((user) => (
                      <li key={user.uid} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`user-${user.uid}`}
                          checked={selectedUsers.includes(user.uid)}
                          onChange={() => {
                            setSelectedUsers(
                              selectedUsers.includes(user.uid)
                                ? selectedUsers.filter(id => id !== user.uid)
                                : [...selectedUsers, user.uid]
                            );
                          }}
                          className="h-4 w-4 rounded text-blue-600"
                        />
                        <label htmlFor={`user-${user.uid}`} className="ml-2 text-sm">
                          {user.displayName} ({user.email})
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsNotificationModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Send Announcement</Button>
            </div>
          </form>
        </DialogPanel>
      </Dialog>

      {/* Add User Modal */}
      <Dialog
        open={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        static={true}
      >
        <DialogPanel>
          <div className="flex justify-between items-center border-b p-4">
            <Title>Add New User</Title>
            <button onClick={() => setIsUserModalOpen(false)}>
              <RiCloseLine className="size-5" />
            </button>
          </div>

          <form onSubmit={handleAddUser} className="p-4">
            <div className="space-y-4">
              <div>
                <Text className="font-medium mb-1">Full Name</Text>
                <TextInput
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                  placeholder="User's full name"
                  required
                />
              </div>

              <div>
                <Text className="font-medium mb-1">Email</Text>
                <TextInput
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <Text className="font-medium mb-1">Role</Text>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser({...newUser, role: value})}
                >
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsUserModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add User</Button>
            </div>
          </form>
        </DialogPanel>
      </Dialog>
    </main>
  );
}