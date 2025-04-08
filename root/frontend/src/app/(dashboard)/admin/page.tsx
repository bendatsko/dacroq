"use client";

import { useState, useEffect, useRef } from "react";
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
  RiPlayLine,
  RiStopLine,
  RiRestartLine,
  RiServerLine,
  RiUsbLine,
  RiListSettingsLine,
  RiCheckLine,
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
  deleteDoc,
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

interface User {
  uid: string;
  displayName: string;
  email: string;
  joinDate: string;
  lastOnlineDate: any;
  testsRun: number;
  accountState: string;
  role: string;
  photoURL?: string;
}

interface ServerStatus {
  status: 'running' | 'stopped' | 'error';
  port: string;
  uptime: string;
  version: string;
  lastRestart: string;
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

// Terminal Component with Interactive Capabilities
function ServerTerminal({ title, serverType, onCommand, status, onStatusChange }) {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState([
    { text: `${serverType} server initialized.`, type: 'system' },
    { text: `Type 'help' for available commands.`, type: 'system' },
  ]);
  const terminalRef = useRef(null);

  // Keep terminal scrolled to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!command.trim()) return;

    // Add command to terminal output
    setOutput(prev => [...prev, { text: `$ ${command}`, type: 'command' }]);
    
    // Process command
    processCommand(command);
    
    // Clear input
    setCommand("");
  };

  const processCommand = (cmd) => {
    const cmdLower = cmd.trim().toLowerCase();
    
    // Basic command processing
    if (cmdLower === 'help') {
      setOutput(prev => [...prev, { 
        text: `Available commands:
  status - Show server status
  start - Start the server
  stop - Stop the server
  restart - Restart the server
  port [PORT] - Set server port (e.g., port /dev/tty.usbmodem1234)
  clear - Clear terminal
  help - Show this help message`, 
        type: 'result' 
      }]);
    } 
    else if (cmdLower === 'clear') {
      setOutput([{ text: `Terminal cleared.`, type: 'system' }]);
    }
    else if (cmdLower === 'status') {
      const statusText = status.status === 'running' 
        ? `Server is running on port ${status.port}.\nUptime: ${status.uptime}\nVersion: ${status.version}`
        : `Server is stopped.\nLast run: ${status.lastRestart}`;
      setOutput(prev => [...prev, { text: statusText, type: 'result' }]);
    }
    else if (cmdLower === 'start') {
      if (status.status === 'running') {
        setOutput(prev => [...prev, { text: 'Server is already running.', type: 'error' }]);
      } else {
        setOutput(prev => [...prev, { text: `Starting ${serverType} server on port ${status.port}...`, type: 'system' }]);
        setTimeout(() => {
          setOutput(prev => [...prev, { text: `Server started successfully.`, type: 'success' }]);
          onStatusChange({ ...status, status: 'running', lastRestart: new Date().toISOString() });
        }, 500);
      }
    }
    else if (cmdLower === 'stop') {
      if (status.status !== 'running') {
        setOutput(prev => [...prev, { text: 'Server is not running.', type: 'error' }]);
      } else {
        setOutput(prev => [...prev, { text: `Stopping ${serverType} server...`, type: 'system' }]);
        setTimeout(() => {
          setOutput(prev => [...prev, { text: `Server stopped successfully.`, type: 'success' }]);
          onStatusChange({ ...status, status: 'stopped' });
        }, 500);
      }
    }
    else if (cmdLower === 'restart') {
      setOutput(prev => [...prev, { text: `Restarting ${serverType} server...`, type: 'system' }]);
      setTimeout(() => {
        setOutput(prev => [...prev, { text: `Server restarted successfully on port ${status.port}.`, type: 'success' }]);
        onStatusChange({ ...status, status: 'running', lastRestart: new Date().toISOString() });
      }, 800);
    }
    else if (cmdLower.startsWith('port ')) {
      const newPort = cmd.substring(5).trim();
      if (!newPort) {
        setOutput(prev => [...prev, { text: 'Please specify a port.', type: 'error' }]);
      } else {
        setOutput(prev => [...prev, { text: `Setting port to ${newPort}...`, type: 'system' }]);
        setTimeout(() => {
          setOutput(prev => [...prev, { text: `Port changed successfully.`, type: 'success' }]);
          onStatusChange({ ...status, port: newPort });
        }, 300);
      }
    }
    else {
      // For any other command, pass to parent handler
      if (onCommand) {
        const result = onCommand(cmd);
        if (result) {
          setOutput(prev => [...prev, { text: result, type: 'result' }]);
        } else {
          setOutput(prev => [...prev, { text: `Command not recognized: ${cmd}`, type: 'error' }]);
        }
      } else {
        setOutput(prev => [...prev, { text: `Command not recognized: ${cmd}`, type: 'error' }]);
      }
    }
  };

  // For controlled input
  const handleChange = (e) => {
    setCommand(e.target.value);
  };

  // Quick actions
  const handleQuickAction = (action) => {
    switch(action) {
      case 'start':
        processCommand('start');
        break;
      case 'stop':
        processCommand('stop');
        break;
      case 'restart':
        processCommand('restart');
        break;
      default:
        break;
    }
  };

  return (
    <Card className="h-full shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4">
        <Flex alignItems="center" justifyContent="between" className="mb-2">
          <div className="flex items-center gap-2">
            <RiTerminalBoxLine className="size-5 text-gray-500" />
            <Title>{title}</Title>
            <span className="text-sm ml-2 text-gray-500">
              {status.status === 'running' ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="light" 
              size="xs" 
              onClick={() => handleQuickAction('start')}
              disabled={status.status === 'running'}
              title="Start Server"
              className="p-1.5 text-gray-700"
            >
              <RiPlayLine className="size-4" />
            </Button>
            <Button 
              variant="light" 
              size="xs" 
              onClick={() => handleQuickAction('stop')}
              disabled={status.status !== 'running'}
              title="Stop Server"
              className="p-1.5 text-gray-700"
            >
              <RiStopLine className="size-4" />
            </Button>
            <Button 
              variant="light" 
              size="xs" 
              onClick={() => handleQuickAction('restart')}
              title="Restart Server"
              className="p-1.5 text-gray-700"
            >
              <RiRestartLine className="size-4" />
            </Button>
          </div>
        </Flex>
        
        <div 
          ref={terminalRef} 
          className="bg-gray-900 text-gray-200 p-3 rounded-md h-48 overflow-auto font-mono text-sm mb-2"
        >
          {output.map((line, index) => (
            <div key={index} className={`
              ${line.type === 'command' ? 'text-white' : ''}
              ${line.type === 'result' ? 'text-gray-300' : ''}
              ${line.type === 'error' ? 'text-red-400' : ''}
              ${line.type === 'success' ? 'text-green-400' : ''}
              ${line.type === 'system' ? 'text-blue-400' : ''}
              whitespace-pre-wrap
            `}>
              {line.text}
            </div>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="flex">
          <div className="flex items-center bg-gray-800 rounded-md w-full">
            <span className="text-gray-400 pl-3">$</span>
            <input
              type="text"
              value={command}
              onChange={handleChange}
              className="flex-1 bg-transparent border-0 text-gray-200 p-2 outline-none focus:ring-0 font-mono"
              placeholder="Type command..."
              autoComplete="off"
            />
          </div>
        </form>

        <div className="mt-3 flex items-center text-xs text-gray-500">
          <RiUsbLine className="mr-1 size-3.5" />
          <span>Port: {status.port}</span>
          <span className="mx-2">•</span>
          <RiServerLine className="mr-1 size-3.5" />
          <span>Version: {status.version}</span>
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

  // Server status
  const [apiServerStatus, setApiServerStatus] = useState({
    status: 'stopped',
    port: '/dev/tty.usbmodem144301',
    uptime: '0h 0m',
    version: 'v1.2.3',
    lastRestart: new Date().toISOString()
  });

  const [testbedStatus, setTestbedStatus] = useState({
    status: 'stopped',
    port: '/dev/tty.usbmodem144302',
    uptime: '0h 0m',
    version: 'v0.9.1',
    lastRestart: new Date().toISOString()
  });

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
      
      // If we got an empty array, add some sample users for UI demo
      if (firestoreUsers.length === 0) {
        firestoreUsers.push(
          {
            uid: 'sample1',
            displayName: 'Benjamin Datsko',
            email: 'bdatsko@umich.edu',
            joinDate: new Date().toISOString(),
            lastOnlineDate: new Date().toISOString(),
            testsRun: 12,
            accountState: 'enabled',
            role: 'admin',
          },
          {
            uid: 'sample2',
            displayName: 'Ben Datsko',
            email: 'bldatsko@gmail.com',
            joinDate: new Date().toISOString(),
            lastOnlineDate: new Date().toISOString(),
            testsRun: 5,
            accountState: 'enabled',
            role: 'user',
          },
          {
            uid: 'sample3',
            displayName: 'B D',
            email: 'mcakount@gmail.com',
            joinDate: new Date().toISOString(),
            lastOnlineDate: new Date().toISOString(),
            testsRun: 2,
            accountState: 'enabled',
            role: 'moderator',
          }
        );
      }
      
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
      
      // If we got an empty array, add sample notifications for UI demo
      if (notificationsData.length === 0) {
        notificationsData.push(
          {
            id: 'sample1',
            title: 'System Maintenance',
            message: 'Scheduled maintenance will occur tonight at 2 AM UTC.',
            date: new Date(),
            type: 'system',
            global: true,
            readBy: [],
            createdBy: 'admin',
            createdByName: 'System Admin',
            deleted: false,
          },
          {
            id: 'sample2',
            title: 'New Feature Released',
            message: 'We\'ve added a new terminal interface to the admin panel!',
            date: new Date(),
            type: 'update',
            global: true,
            readBy: [],
            createdBy: 'admin',
            createdByName: 'System Admin',
            deleted: false,
          }
        );
      }
      
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
      let user = { uid: 'system', displayName: 'System' };
      
      if (userStr) {
        try {
          user = JSON.parse(userStr);
        } catch (e) {
          console.error("Error parsing user data:", e);
        }
      }
      
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

  // Handle API Terminal commands
  const handleApiCommand = (cmd) => {
    // This could be extended to handle custom API server commands
    return null; // Return null means it will show "command not recognized"
  };

  // Handle Testbed Terminal commands
  const handleTestbedCommand = (cmd) => {
    // This could be extended to handle custom testbed commands
    return null;
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

  // Get announcement count by type
  const getAnnouncementCounts = () => {
    const counts = {
      alert: 0,
      update: 0,
      system: 0,
      info: 0,
    };
    
    notifications.forEach(notification => {
      if (notification.type in counts) {
        counts[notification.type]++;
      }
    });
    
    return counts;
  };

  const announcementCounts = getAnnouncementCounts();
  
  // Get role class
  const getRoleClass = (role) => {
    switch (role) {
      case 'admin':
        return 'text-blue-600';
      case 'moderator':
        return 'text-indigo-600';
      default:
        return 'text-gray-600';
    }
  };

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
            className="flex items-center"
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
            className="flex items-center"
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

      <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6 mb-6">
        {/* User Management Card */}
        <Card className="col-span-1 shadow-sm rounded-lg !border !border-gray-200 dark:!border-gray-700 overflow-hidden">
          <div className="p-4">
            <Flex alignItems="center" justifyContent="between" className="mb-3">
              <div>
                <Title>Userbase</Title>
                <Text>Total Users: {users.length}</Text>
              </div>
              <Button
                onClick={() => setIsUserModalOpen(true)}
                variant="light"
                size="sm"
                className="flex items-center gap-1"
              >
                <RiUserAddLine className="size-4" />
                Add User
              </Button>
            </Flex>

            <Divider className="my-2" />
            
            <div className="flex items-center gap-3 mb-3">
              <div className="text-center px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-xs text-blue-600 font-medium block">Admin</span>
                <span className="font-medium">{users.filter(u => u.role === 'admin').length}</span>
              </div>
              
              <div className="text-center px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-xs text-indigo-600 font-medium block">Mod</span>
                <span className="font-medium">{users.filter(u => u.role === 'moderator').length}</span>
              </div>
              
              <div className="text-center px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="text-xs text-gray-600 font-medium block">User</span>
                <span className="font-medium">{users.filter(u => u.role === 'user').length}</span>
              </div>
            </div>
            
            {users.length > 0 && (
              <div className="mt-2 text-sm">
                <div className="flex justify-between text-gray-500 border-b pb-1 mb-2">
                  <span>Name</span>
                  <span>Role</span>
                </div>
                {users.slice(0, 3).map((user) => (
                  <div key={user.uid} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
                    <span className="font-medium">{user.displayName}</span>
                    <span className={getRoleClass(user.role)}>
                      {user.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Announcement Tool Card */}
        <Card className="col-span-1 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4">
            <Flex alignItems="center" justifyContent="between" className="mb-3">
              <div>
                <Title>Announcement Tool</Title>
                <Text>Total Announcements: {notifications.length}</Text>
              </div>
              <Button
                onClick={() => setIsNotificationModalOpen(true)}
                variant="light"
                size="sm"
                className="flex items-center gap-1"
              >
                <RiNotification2Line className="size-4" />
                Create
              </Button>
            </Flex>
            
            <Divider className="my-2" />

            <div className="mb-3 relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <RiSearchLine className="size-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search announcements..."
                value={notificationSearchQuery}
                onChange={(e) => setNotificationSearchQuery(e.target.value)}
                className="pl-8 w-full bg-gray-50 dark:bg-gray-800 border-none rounded-md py-2 text-sm"
              />
            </div>

            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <RiNotification2Line className="mx-auto size-10 text-gray-400" />
                <Text className="mt-2 text-gray-500">No announcements</Text>
                <Button 
                  size="xs"
                  variant="light"
                  onClick={() => setIsNotificationModalOpen(true)} 
                  className="mt-3"
                >
                  <RiAddLine className="mr-1 size-3.5" />
                  New Announcement
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden overflow-y-auto max-h-[160px]">
                {filteredNotifications.slice(0, 3).map((notification) => (
                  <div 
                    key={notification.id} 
                    className="py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <div className="flex justify-between items-start">
                      <div className="overflow-hidden flex-1">
                        <div className="font-medium text-sm truncate">{notification.title}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="text-xs text-gray-600">
                            {notification.type}
                          </span>
                          <span className="mx-1">•</span>
                          <span>{formatDate(notification.date)}</span>
                        </div>
                      </div>
                      <Button
                        variant="light"
                        size="xs"
                        className="shrink-0 ml-2 h-6 w-6 p-0 text-gray-500"
                        onClick={() => handleDeleteNotification(notification.id)}
                      >
                        <RiCloseLine className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Resource Management Card */}
        <Card className="col-span-1 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4">
            <Title className="mb-2">Server Management</Title>
            <Text className="text-sm text-gray-500 mb-2">
              Manage API server and testbed connections
            </Text>
            <Divider className="my-2" />
            
            <Accordion type="single" className="mt-2" collapsible>
              <AccordionItem value="item-1" className="border-b border-gray-100 dark:border-gray-800">
                <AccordionTrigger className="py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <RiServerLine className="size-4 text-blue-500" />
                    API Server Control
                    <span className="text-xs text-gray-500 ml-2">
                      {apiServerStatus.status === 'running' ? 'Running' : 'Stopped'}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <ServerTerminal 
                    title="Go API Server"
                    serverType="API"
                    status={apiServerStatus}
                    onStatusChange={setApiServerStatus}
                    onCommand={handleApiCommand}
                  />
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border-b border-gray-100 dark:border-gray-800">
                <AccordionTrigger className="py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <RiListSettingsLine className="size-4 text-blue-500" />
                    Testbed Control
                    <span className="text-xs text-gray-500 ml-2">
                      {testbedStatus.status === 'running' ? 'Running' : 'Stopped'}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <ServerTerminal 
                    title="Testbed Controller"
                    serverType="Testbed"
                    status={testbedStatus}
                    onStatusChange={setTestbedStatus}
                    onCommand={handleTestbedCommand}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </Card>
      </Grid>

      <TabGroup index={activeTab} onIndexChange={setActiveTab}>
        <TabList className="mb-6">
          <Tab>Users</Tab>
          <Tab>Announcements</Tab>
          <Tab>System Status</Tab>
        </TabList>
        
        <TabPanels>
          {/* USERS TAB */}
          <TabPanel>
            <section className="mb-6">
              <Card>
                <Flex alignItems="center" justifyContent="between" className="mb-4 p-4 border-b border-gray-200 dark:border-gray-700">
                  <Title>User Management</Title>
                  <Button 
                    onClick={() => setIsUserModalOpen(true)} 
                    className="flex items-center gap-1"
                    variant="light"
                  >
                    <RiUserAddLine className="size-4" />
                    Add User
                  </Button>
                </Flex>

                <div className="p-4">
                  {loading ? (
                    <div className="flex justify-center items-center h-40">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="mx-auto size-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <RiUserLine className="size-6 text-gray-400" />
                      </div>
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No users</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Get started by adding new users to the system.
                      </p>
                      <div className="mt-6">
                        <Button 
                          onClick={() => setIsUserModalOpen(true)}
                          variant="light"
                        >
                          <RiAddLine className="mr-2 size-4" />
                          Add User
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Name</TableHeaderCell>
                          <TableHeaderCell>Email</TableHeaderCell>
                          <TableHeaderCell>Role</TableHeaderCell>
                          <TableHeaderCell>Status</TableHeaderCell>
                          <TableHeaderCell>Joined</TableHeaderCell>
                          <TableHeaderCell>Tests Run</TableHeaderCell>
                          <TableHeaderCell>Actions</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.uid}>
                            <TableCell>{user.displayName}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell className={getRoleClass(user.role)}>{user.role}</TableCell>
                            <TableCell className="text-green-600">{user.accountState}</TableCell>
                            <TableCell>{formatDate(user.joinDate)}</TableCell>
                            <TableCell>{user.testsRun}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="light"
                                  size="xs"
                                  title="Edit User"
                                  className="h-8 w-8 p-0"
                                >
                                  <RiUserSettingsLine className="size-4" />
                                </Button>
                                <Button
                                  variant="light"
                                  size="xs"
                                  title="Toggle User Status"
                                  className="h-8 w-8 p-0"
                                >
                                  {user.accountState === "enabled" ? (
                                    <RiShieldLine className="size-4" />
                                  ) : (
                                    <RiCheckLine className="size-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </Card>
            </section>
          </TabPanel>

          {/* ANNOUNCEMENTS TAB */}
          <TabPanel>
            <section className="mb-6">
              <Card>
                <Flex alignItems="center" justifyContent="between" className="mb-4 p-4 border-b border-gray-200 dark:border-gray-700">
                  <Title>System Announcements</Title>
                  <Button 
                    onClick={() => setIsNotificationModalOpen(true)} 
                    className="flex items-center gap-1"
                    variant="light"
                  >
                    <RiNotification2Line className="size-4" />
                    Create Announcement
                  </Button>
                </Flex>

                <div className="p-4">                  
                  <div className="mb-4 relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <RiSearchLine className="size-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search announcements..."
                      value={notificationSearchQuery}
                      onChange={(e) => setNotificationSearchQuery(e.target.value)}
                      className="pl-8 w-full bg-gray-50 dark:bg-gray-800 border-none rounded-md py-2 text-sm"
                    />
                  </div>

                  <Divider className="my-4" />

                  {filteredNotifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="mx-auto size-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <RiNotification2Line className="size-6 text-gray-400" />
                      </div>
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No announcements</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Get started by creating a new system announcement.
                      </p>
                      <div className="mt-6">
                        <Button 
                          onClick={() => setIsNotificationModalOpen(true)}
                          variant="light"
                        >
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
                                <span className="text-gray-600">
                                  {notification.type}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-600">
                                  {notification.global ? "All Users" : "Targeted"}
                                </span>
                              </TableCell>
                              <TableCell>{formatDate(notification.date)}</TableCell>
                              <TableCell>{notification.createdByName || "Unknown"}</TableCell>
                              <TableCell>
                                <Button
                                  variant="light"
                                  size="xs"
                                  onClick={() => handleDeleteNotification(notification.id)}
                                  className="text-gray-600"
                                >
                                  <RiCloseLine className="size-4 mr-1" />
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
              </Card>
            </section>
          </TabPanel>

          {/* SYSTEM STATUS TAB */}
          <TabPanel>
            <Grid numItems={1} numItemsMd={2} className="gap-6 mb-6">
              <Col numColSpan={1} numColSpanMd={2}>
                <Card className="p-4">
                  <Title>System Overview</Title>
                  <Divider className="my-3" />
                  
                  <Grid numItems={1} numItemsMd={2} numItemsLg={4} className="gap-3 mt-3">
                    <Card className="p-3">
                      <Text className="text-gray-500">Users</Text>
                      <Metric className="mt-1">{users.length}</Metric>
                    </Card>
                    <Card className="p-3">
                      <Text className="text-gray-500">Announcements</Text>
                      <Metric className="mt-1">{notifications.length}</Metric>
                    </Card>
                    <Card className="p-3">
                      <Text className="text-gray-500">API Status</Text>
                      <div className="flex items-center mt-1">
                        <span 
                          className={`inline-block w-3 h-3 rounded-full mr-2 ${
                            apiServerStatus.status === 'running' ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        ></span>
                        <Metric>{apiServerStatus.status === 'running' ? 'Online' : 'Offline'}</Metric>
                      </div>
                    </Card>
                    <Card className="p-3">
                      <Text className="text-gray-500">Testbed Status</Text>
                      <div className="flex items-center mt-1">
                        <span 
                          className={`inline-block w-3 h-3 rounded-full mr-2 ${
                            testbedStatus.status === 'running' ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        ></span>
                        <Metric>{testbedStatus.status === 'running' ? 'Online' : 'Offline'}</Metric>
                      </div>
                    </Card>
                  </Grid>
                </Card>
              </Col>

              <ServerTerminal 
                title="API Server Terminal" 
                serverType="API"
                status={apiServerStatus}
                onStatusChange={setApiServerStatus}
                onCommand={handleApiCommand}
              />
              
              <ServerTerminal 
                title="Testbed Terminal" 
                serverType="Testbed"
                status={testbedStatus}
                onStatusChange={setTestbedStatus}
                onCommand={handleTestbedCommand}
              />
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
              size="sm"
              onClick={() => setIsNotificationModalOpen(false)}
              className="p-1 text-gray-600"
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
                onClick={() => setIsNotificationModalOpen(false)}
                className="text-gray-600"
              >
                Cancel
              </Button>
              <Button type="submit" variant="light">
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
              size="sm"
              onClick={() => setIsUserModalOpen(false)}
              className="p-1 text-gray-600"
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
                onClick={() => setIsUserModalOpen(false)}
                className="text-gray-600"
              >
                Cancel
              </Button>
              <Button type="submit" variant="light">
                Add User
              </Button>
            </div>
          </form>
        </DialogPanel>
      </Dialog>
    </main>
  );
}