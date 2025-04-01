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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/Accordion';

import {
  RiAddCircleFill,
  RiArrowLeftRightLine,
  RiCheckboxMultipleFill,
  RiCoupon3Fill,
} from '@remixicon/react';

import { Button } from "@/components/Button"

import { Card } from "@/components/Card";


import {
  RiAddFill,
  RiArrowRightSLine,
  RiBookOpenLine,
  RiDatabase2Line,
} from '@remixicon/react';

const data = [
  {
    id: 1,
    name: 'Report name',
    description: 'Description',
    href: '#',
  },
  {
    id: 2,
    name: 'Report name',
    description: 'Description',
    href: '#',
  },
  {
    id: 3,
    name: 'Report name',
    description: 'Description',
    href: '#',
  },
  {
    id: 4,
    name: 'Report name',
    description: 'Description',
    href: '#',
  },
  {
    id: 5,
    name: 'Report name',
    description: 'Description',
    href: '#',
  },
  {
    id: 6,
    name: 'Report name',
    description: 'Description',
    href: '#',
  },
];





// Interfaces
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

function formatDate(date) {
  if (!date) return "Never";
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) {
      return "Invalid Date";
    }
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Invalid Date";
  }
}

// Terminal Component
function Terminal({ framework, title }) {
  return (
      <Card className="h-full shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-5">
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
        </div>
      </Card>
  );
}
// TestBench Configuration Component
function TestBenchConfig() {
  return (
      <Card className="shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-5">
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
  const [notificationSearchQuery, setNotificationSearchQuery] = useState("");

  // Maintenance mode state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [whitelistedEmails, setWhitelistedEmails] = useState([]);

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
      const userRef = collection(db, "users");
      await addDoc(userRef, {
        displayName: newUser.displayName,
        email: newUser.email,
        role: newUser.role,
        accountState: "enabled",
        createdAt: new Date().toISOString(),
        testsRun: 0,
      });
      setNewUser({
        displayName: "",
        email: "",
        role: "user",
      });
      setIsUserModalOpen(false);
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
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        setError("User not authenticated");
        return;
      }
      const user = JSON.parse(userStr);
      if (!newTitle.trim() || !newMessage.trim()) {
        setError("Title and message are required");
        return;
      }
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
      await addDoc(collection(db, "notifications"), newNotification);
      setNewTitle("");
      setNewMessage("");
      setNewType("info");
      setIsGlobal(true);
      setSelectedUsers([]);
      setIsNotificationModalOpen(false);
      setError(null);
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
  const filteredNotifications =
      notificationSearchQuery.trim() === ""
          ? notifications
          : notifications.filter((notification) => {
            const query = notificationSearchQuery.toLowerCase();
            return (
                (notification.title &&
                    notification.title.toLowerCase().includes(query)) ||
                (notification.message &&
                    notification.message.toLowerCase().includes(query)) ||
                (notification.type &&
                    notification.type.toLowerCase().includes(query))
            );
          });

  return (
      <main className="p-0 md:p-6">
        <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              System Tools & Settings
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage users, announcements, and test framework
            </p>
          </div>

          <div className="flex gap-2 mt-3 sm:mt-0">
            <Button
                variant={maintenanceMode ? "light" : "secondary"}
                color={maintenanceMode ? "amber" : "gray"}
                onClick={toggleMaintenanceMode}
            >
              <RiShieldLine className="mr-2 size-4" />
              {maintenanceMode
                  ? "Disable Maintenance Mode"
                  : "Enable Maintenance Mode"}
            </Button>
            <Button
                variant="secondary"
                color="gray"
                onClick={() => {
                  loadUsers();
                  loadNotifications();
                }}
            >
              <RiRefreshLine className="mr-2 size-4" />
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
            <Card className="mb-6 bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-500">
              <Flex alignItems="center" justifyContent="between" className="mb-4">
                <Title>Maintenance Mode Active</Title>
                <Badge color="amber">System Restricted</Badge>
              </Flex>
              <Text className="text-amber-800 dark:text-amber-400">
                While maintenance mode is active, non-admin users will be redirected to
                the home page. No further logins will be allowed until maintenance mode
                is disabled.
              </Text>
            </Card>
        )}
        <Grid numItems={1} numItemsSm={1} numItemsLg={1} className="gap-6 mb-6">



          {/* User Management Card */}
          <Card className="col-span-1 shadow-sm rounded-lg !border !border-gray-200 dark:!border-gray-700 overflow-hidden">
            <div className="p-5">
              <Flex alignItems="center" justifyContent="between" className="mb-5">
                <div>
                  <Title>Userbase</Title>
                  <Text>Total Users: {users.length}</Text>
                </div>
                <Button
                    onClick={() => setIsUserModalOpen(true)}
                    color="blue"
                    size="sm"
                    className="flex items-center gap-1"
                >
                  <RiUserAddLine className="size-4" />
                  Add User
                </Button>
              </Flex>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-medium text-gray-500 dark:text-gray-400 border-b pb-2">
                  <span>User Role</span>
                  <span>Count</span>
                </div>

                <div className="flex justify-between items-center">
                  <Flex alignItems="center" justifyContent="start" className="gap-2">
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 border-0">
            Admin
          </span>
                    <span>Administrators</span>
                  </Flex>
                  <span className="font-medium">
          {users.filter((u) => u.role === "admin").length}
        </span>
                </div>

                <div className="flex justify-between items-center">
                  <Flex alignItems="center" justifyContent="start" className="gap-2">
          <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 border-0">
            Mod
          </span>
                    <span>Moderators</span>
                  </Flex>
                  <span className="font-medium">
          {users.filter((u) => u.role === "moderator").length}
        </span>
                </div>

                <div className="flex justify-between items-center">
                  <Flex alignItems="center" justifyContent="start" className="gap-2">
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-0">
            User
          </span>
                    <span>Standard Users</span>
                  </Flex>
                  <span className="font-medium">
          {users.filter((u) => u.role === "user").length}
        </span>
                </div>
              </div>
            </div>
          </Card>


          {/* Announcement Tool Card */}
          <Card className="col-span-1 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5">
              <Flex alignItems="center" justifyContent="between" className="mb-5">
                <div>
                  <Title>Announcement Tool</Title>
                  <Text>Total Announcements: {notifications.length}</Text>
                </div>
                <Button
                    onClick={() => setIsNotificationModalOpen(true)}
                    color="indigo"
                    size="sm"
                    className="flex items-center gap-1"
                >
                  <RiNotification2Line className="size-4" />
                  Create
                </Button>
              </Flex>

              <div className="mb-4 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <RiSearchLine className="size-4 text-gray-400" />
                </div>
                <TextInput
                    placeholder="Search announcements..."
                    value={notificationSearchQuery}
                    onChange={(e) => setNotificationSearchQuery(e.target.value)}
                    className="pl-10"
                />
              </div>

              <div className="mt-5">
                {filteredNotifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <RiNotification2Line className="mx-auto size-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        No announcements
                      </h3>
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
                    <span
                        className={`px-2 py-0.5 text-xs rounded-full font-normal ${
                            notification.type === "alert"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                                : notification.type === "update"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                                    : notification.type === "system"
                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                    >
                      {notification.type}
                    </span>
                                </TableCell>
                                <TableCell>
                    <span
                        className={`px-2 py-0.5 text-xs rounded-full font-normal ${
                            notification.global
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
                        }`}
                    >
                      {notification.global ? "All Users" : "Targeted"}
                    </span>
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
              </div>
            </div>
          </Card>


          {/* Test Bench Card */}
          <Card className="col-span-1 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">

              <Flex >
              <div className="mx-auto max-w-lg">
                <h1 className="text-md font-semibold text-gray-900 dark:text-gray-50">
                  Managing Your Booking Online
                </h1>
                <Accordion type="single" defaultValue="item-1" className="mt-3" collapsible>
                  <AccordionItem value="item-1">
                    <AccordionTrigger>
          <span className="flex items-center gap-2 ">
            <RiCoupon3Fill className="group-data-[disabled]:texdark:t-blue-200 group-data-[disabled]:t8xt-blue-200 size-4 text-blue-500" />
            Access Your Booking
          </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p>
                        Simply navigate to the "My Trips" section on our website and input
                        your booking reference and last name to view your itinerary details.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>
          <span className="flex items-center gap-2 ">
            <RiArrowLeftRightLine className="size-4 text-blue-500 group-data-[disabled]:text-blue-200 dark:group-data-[disabled]:text-blue-900" />
            Change Flights
          </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ol className="flex flex-col gap-2">
                        <li>
              <span className="font-semibold text-gray-900 dark:text-gray-50">
                Step 1:
              </span>{" "}
                          Within your booking details, select "Change Flights."
                        </li>
                        <li>
              <span className="font-semibold text-gray-900 dark:text-gray-50">
                Step 2:
              </span>{" "}
                          Follow the prompts to select new flight options and confirm the
                          changes.
                        </li>
                        <li>
              <span className="font-semibold text-gray-900 dark:text-gray-50">
                Step 3:
              </span>{" "}
                          Review your new flight details and any fare differences.
                        </li>
                        <li>
              <span className="font-semibold text-gray-900 dark:text-gray-50">
                Step 4:
              </span>{" "}
                          Complete the change and receive your updated itinerary via email.
                        </li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3" disabled>
                    <AccordionTrigger>
          <span className="flex items-center gap-2 ">
            <RiAddCircleFill className="size-4 text-blue-500 group-data-[disabled]:text-blue-200 dark:group-data-[disabled]:text-blue-900" />
            Add Special Requests
          </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p>
                        Look for the "Special Requests" option within your booking to
                        specify any meal preferences, seating arrangements, or assistance
                        services you may require during your flight.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4">
                    <AccordionTrigger>
          <span className="flex items-center gap-2 ">
            <RiCheckboxMultipleFill className="size-4 text-blue-500 group-data-[disabled]:text-blue-200 dark:group-data-[disabled]:text-blue-900" />
            Check-In Online
          </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ol className="flex flex-col gap-2">
                        <li>
              <span className="font-semibold text-gray-900 dark:text-gray-50">
                Step 1:
              </span>{" "}
                          Starting 48 hours before your flight, access the "Check-In"
                          option.
                        </li>
                        <li>
              <span className="font-semibold text-gray-900 dark:text-gray-50">
                Step 2:
              </span>{" "}
                          Confirm your details and select your seats to complete the online
                          check-in process.
                        </li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              </Flex>




              {/*<Flex justifyContent="end">*/}
              {/*  <Button*/}
              {/*      variant="secondary"*/}
              {/*      color="green"*/}
              {/*      onClick={() => setActiveTab(2)}*/}
              {/*      className="flex items-center gap-1"*/}
              {/*      size="sm"*/}
              {/*  >*/}
              {/*    <RiTerminalBoxLine className="size-4" />*/}
              {/*    Open Test Bench*/}
              {/*  </Button>*/}
              {/*</Flex>*/}
          </Card>


        </Grid>

        <TabGroup index={activeTab} onIndexChange={setActiveTab}>
          <TabPanels>
            {/* USERS TAB */}
            {/*<TabPanel>*/}
            {/*  <section className="mb-6">*/}
            {/*    {loading ? (*/}
            {/*        <div className="flex h-64 items-center justify-center">*/}
            {/*          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900/10 border-t-gray-900 dark:border-gray-50/10 dark:border-t-gray-50"></div>*/}
            {/*        </div>*/}
            {/*    ) : (*/}
            {/*        */}
            {/*    )}*/}
            {/*  </section>*/}
            {/*</TabPanel>*/}

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
                        value={notificationSearchQuery}
                        onChange={(e) => setNotificationSearchQuery(e.target.value)}
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
                              <span
                                  className={`px-2 py-0.5 text-xs rounded-full font-normal ${
                                      notification.type === "alert"
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                                          : notification.type === "update"
                                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                                              : notification.type === "system"
                                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                  }`}
                              >
                                {notification.type}
                              </span>
                                  </TableCell>
                                  <TableCell>
                              <span
                                  className={`px-2 py-0.5 text-xs rounded-full font-normal ${
                                      notification.global
                                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                          : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
                                  }`}
                              >
                                {notification.global ? "All Users" : "Targeted"}
                              </span>
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
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" aria-hidden="true" />
          <DialogPanel className="max-w-lg w-full mx-auto rounded-lg shadow-lg bg-white dark:bg-gray-900 z-50 overflow-hidden">
            <div className="flex justify-between items-center border-b p-4">
              <Title>Create New Announcement</Title>
              <Button
                  variant="light"
                  color="gray"
                  size="sm"
                  onClick={() => setIsNotificationModalOpen(false)}
                  className="p-1"
              >
                <RiCloseLine className="size-5" />
              </Button>
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
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center">
                      <input
                          type="radio"
                          id="audienceGlobal"
                          name="audience"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                    <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-800">
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
                                            ? selectedUsers.filter((id) => id !== user.uid)
                                            : [...selectedUsers, user.uid]
                                    );
                                  }}
                                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
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
                    color="gray"
                    onClick={() => setIsNotificationModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" color="indigo">
                  Send Announcement
                </Button>
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
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" aria-hidden="true" />
          <DialogPanel className="max-w-lg w-full mx-auto rounded-lg shadow-lg bg-white dark:bg-gray-900 z-50 overflow-hidden">
            <div className="flex justify-between items-center border-b p-4">
              <Title>Add New User</Title>
              <Button
                  variant="light"
                  color="gray"
                  size="sm"
                  onClick={() => setIsUserModalOpen(false)}
                  className="p-1"
              >
                <RiCloseLine className="size-5" />
              </Button>

            </div>

            <form onSubmit={handleAddUser} className="p-4">
              <div className="space-y-4">
                <div>
                  <Text className="font-medium mb-1">Full Name</Text>
                  <TextInput
                      value={newUser.displayName}
                      onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                      placeholder="User's full name"
                      required
                  />
                </div>

                <div>
                  <Text className="font-medium mb-1">Email</Text>
                  <TextInput
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="user@example.com"
                      required
                  />
                </div>

                <div>
                  <Text className="font-medium mb-1">Role</Text>
                  <div className="relative">
                    <Select
                        value={newUser.role}
                        onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                        placeholder="Select a role"
                    >
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button
                    type="button"
                    variant="secondary"
                    color="gray"
                    onClick={() => setIsUserModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" color="blue">
                  Add User
                </Button>
              </div>
            </form>
          </DialogPanel>
        </Dialog>
      </main>
  );
}




