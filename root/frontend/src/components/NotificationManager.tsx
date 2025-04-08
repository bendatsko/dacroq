// NotificationManager.tsx - Component for Admin Panel
'use client';

import React, { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Divider } from "@/components/Divider";
import {
  RiNotification2Line,
  RiAddLine,
  RiCloseLine,
  RiDeleteBin5Line,
  RiSearchLine,
  RiInformationLine
} from "@remixicon/react";

// Tremor UI components
import {
  Dialog,
  DialogPanel,
  Select,
  SelectItem,
  Badge,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@tremor/react";

// Firebase
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  getDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// DataTable
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@tremor/react';

// Types
interface Notification {
  id: string;
  title: string;
  message: string;
  date: any; // Firestore timestamp
  type: "system" | "alert" | "update" | "info";
  global: boolean; // If true, notification is for all users
  forUsers?: string[]; // If global is false, specific user IDs
  readBy: string[]; // Array of user IDs who've read this notification
  createdBy: string;
  createdByName: string;
}

interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  role: string;
}

function formatDate(date: any) {
  if (!date) return "Unknown";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleString();
}

export default function NotificationManager() {
  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false); // For create notification modal
  const [isViewOpen, setIsViewOpen] = useState(false); // For view notification details modal
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  // Form fields for creating a new notification
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newType, setNewType] = useState<"system" | "alert" | "update" | "info">("info");
  const [isGlobal, setIsGlobal] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Load notifications from Firestore
  useEffect(() => {
    const notificationsRef = collection(db, "notifications");
    const notificationsQuery = query(
      notificationsRef,
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];

        setNotifications(notificationsData);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        setError("Failed to load notifications");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Load users (for targeting specific users with notifications)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);

        const usersData = usersSnapshot.docs.map(doc => ({
          uid: doc.id,
          displayName: doc.data().displayName || doc.data().name || "Unknown",
          email: doc.data().email || "",
          role: doc.data().role || "user"
        }));

        setUsers(usersData);
      } catch (error) {
        console.error("Error loading users:", error);
        setError("Failed to load users");
      }
    };

    loadUsers();
  }, []);

  // Filter notifications by search query
  const filteredNotifications = searchQuery.trim() === ""
    ? notifications
    : notifications.filter(notification => {
      const query = searchQuery.toLowerCase();
      return (
        (notification.title && notification.title.toLowerCase().includes(query)) ||
        (notification.message && notification.message.toLowerCase().includes(query)) ||
        (notification.type && notification.type.toLowerCase().includes(query))
      );
    });

  // Create a new notification
  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Get current user from localStorage (since we're in admin panel)
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
        createdByName: user.displayName || user.name || "Admin"
      };

      // Add to Firestore
      await addDoc(collection(db, "notifications"), newNotification);

      // Reset form fields and close modal
      setNewTitle("");
      setNewMessage("");
      setNewType("info");
      setIsGlobal(true);
      setSelectedUsers([]);
      setIsOpen(false);
      setError(null);
    } catch (error) {
      console.error("Error creating notification:", error);
      setError("Failed to create notification");
    }
  };

  // Delete a notification
  const handleDeleteNotification = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "notifications", id));

      // Also clean up user notification references
      // This would require additional cleanup in a production system

      setError(null);
    } catch (error) {
      console.error("Error deleting notification:", error);
      setError("Failed to delete notification");
    }
  };

  // View notification details
  const handleViewNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    setIsViewOpen(true);
  };

  // Toggle user selection for targeted notifications
  const handleToggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // DataTable columns for notifications
  const columns = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }: any) => (
        <div className="font-medium">{row.original.title}</div>
      )
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }: any) => {
        const type = row.original.type;
        let badgeColor;

        switch (type) {
          case "alert":
            badgeColor = "amber";
            break;
          case "update":
            badgeColor = "green";
            break;
          case "system":
            badgeColor = "blue";
            break;
          default: // "info"
            badgeColor = "gray";
        }

        return (
          <Badge color={badgeColor} className="capitalize">
            {type}
          </Badge>
        );
      }
    },
    {
      accessorKey: "global",
      header: "Audience",
      cell: ({ row }: any) => (
        <div>
          {row.original.global ? (
            <Badge color="blue">All Users</Badge>
          ) : (
            <Badge color="indigo">Targeted</Badge>
          )}
        </div>
      )
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }: any) => (
        <div>{formatDate(row.original.date)}</div>
      )
    },
    {
      accessorKey: "createdByName",
      header: "Created By",
      cell: ({ row }: any) => (
        <div>{row.original.createdByName || "Unknown"}</div>
      )
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewNotification(row.original)}
          >
            View
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDeleteNotification(row.original.id)}
          >
            <RiDeleteBin5Line className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  const table = useReactTable({
    data: filteredNotifications,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // If loading
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900/10 border-t-gray-900 dark:border-gray-50/10 dark:border-t-gray-50"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Notification Management</h2>
          <p className="text-gray-500 text-sm">
            Create, view, and manage system notifications
          </p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2"
        >
          <RiAddLine className="h-4 w-4" />
          Create Notification
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 p-4 text-amber-800 dark:bg-amber-900/10 dark:text-amber-500">
          <RiInformationLine className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-medium">Recent Notifications</h3>

          {/* Search bar */}
          <div className="relative max-w-xs flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <RiSearchLine className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            {searchQuery && (
              <button
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                onClick={() => setSearchQuery("")}
              >
                <RiCloseLine className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <RiNotification2Line className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No notifications</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating a new notification.
            </p>
            <div className="mt-6">
              <Button onClick={() => setIsOpen(true)}>
                <RiAddLine className="mr-2 h-4 w-4" />
                New Notification
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHeaderCell key={header.id} onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </TableHeaderCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Create Notification Modal */}
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        static={true}
        className="relative z-50"
      >
        <div
          className="fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
        <DialogPanel className="relative z-50 max-w-5xl overflow-visible rounded-lg bg-white p-0 shadow-xl dark:bg-gray-800">
          <form onSubmit={handleCreateNotification} method="POST">
            <div className="absolute right-0 top-0 pr-3 pt-3">
              <button
                type="button"
                className="rounded-tremor-small text-tremor-content-subtle hover:bg-tremor-background-subtle hover:text-tremor-content dark:text-dark-tremor-content-subtle hover:dark:bg-dark-tremor-background-subtle hover:dark:text-tremor-content p-2"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <RiCloseLine className="size-5 shrink-0" aria-hidden={true} />
              </button>
            </div>
            <div className="border-tremor-border dark:border-dark-tremor-border border-b px-6 py-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Create New Notification
              </h3>
            </div>
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 space-y-6 p-6">
                <div>
                  <label
                    htmlFor="notificationTitle"
                    className="block text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    name="notificationTitle"
                    id="notificationTitle"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    placeholder="Notification title"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="notificationType"
                    className="block text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    Notification Type
                  </label>
                  <Select
                    name="notificationType"
                    id="notificationType"
                    className="mt-1"
                    value={newType}
                    onValueChange={(value: any) => setNewType(value)}
                  >
                    <SelectItem value="info">Information</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </Select>
                </div>

                <div>
                  <label
                    htmlFor="notificationMessage"
                    className="block text-sm font-medium text-gray-900 dark:text-gray-100"
                  >
                    Message
                  </label>
                  <textarea
                    name="notificationMessage"
                    id="notificationMessage"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    placeholder="Notification message"
                    required
                  />
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Audience
                  </h4>
                  <div className="mt-2 space-y-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="audienceGlobal"
                        name="audience"
                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={isGlobal}
                        onChange={() => setIsGlobal(true)}
                      />
                      <label
                        htmlFor="audienceGlobal"
                        className="ml-2 block text-sm text-gray-900 dark:text-gray-100"
                      >
                        All users
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="audienceSpecific"
                        name="audience"
                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={!isGlobal}
                        onChange={() => setIsGlobal(false)}
                      />
                      <label
                        htmlFor="audienceSpecific"
                        className="ml-2 block text-sm text-gray-900 dark:text-gray-100"
                      >
                        Specific users
                      </label>
                    </div>
                  </div>
                </div>

                {!isGlobal && (
                  <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Select users ({selectedUsers.length} selected)
                    </h4>
                    <ul className="space-y-2">
                      {users.map((user) => (
                        <li key={user.uid} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`user-${user.uid}`}
                            checked={selectedUsers.includes(user.uid)}
                            onChange={() => handleToggleUserSelection(user.uid)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label
                            htmlFor={`user-${user.uid}`}
                            className="ml-2 block text-sm text-gray-900 dark:text-gray-100"
                          >
                            {user.displayName} ({user.email}) - {user.role}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end border-t border-gray-200 p-4 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button type="submit">
                Create Notification
              </Button>
            </div>
          </form>
        </DialogPanel>
      </Dialog>

      {/* View Notification Details Modal */}
      <Dialog
        open={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        static={true}
        className="relative z-50"
      >
        <div
          className="fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
          onClick={() => setIsViewOpen(false)}
        />
        <DialogPanel className="relative z-50 max-w-3xl overflow-visible rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
          <div className="absolute right-0 top-0 pr-3 pt-3">
            <button
              type="button"
              className="rounded-tremor-small text-tremor-content-subtle hover:bg-tremor-background-subtle hover:text-tremor-content dark:text-dark-tremor-content-subtle hover:dark:bg-dark-tremor-background-subtle hover:dark:text-tremor-content p-2"
              onClick={() => setIsViewOpen(false)}
              aria-label="Close"
            >
              <RiCloseLine className="size-5 shrink-0" aria-hidden={true} />
            </button>
          </div>

          {selectedNotification && (
            <div>
              <div className="mb-4 flex items-center">
                <Badge
                  color={
                    selectedNotification.type === "alert" ? "amber" :
                      selectedNotification.type === "update" ? "green" :
                        selectedNotification.type === "system" ? "blue" :
                          "gray"
                  }
                  className="capitalize mr-2"
                >
                  {selectedNotification.type}
                </Badge>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {selectedNotification.title}
                </h3>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Created by {selectedNotification.createdByName || "Unknown"} on {formatDate(selectedNotification.date)}
                </p>
              </div>

              <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-700">
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {selectedNotification.message}
                </p>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Audience
                </h4>
                <Badge color={selectedNotification.global ? "blue" : "indigo"}>
                  {selectedNotification.global ? "All users" : "Targeted"}
                </Badge>

                {!selectedNotification.global && selectedNotification.forUsers && (
                  <div className="mt-4">
                    <h5 className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Selected users:
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedNotification.forUsers.map(userId => {
                        const user = users.find(u => u.uid === userId);
                        return (
                          <Badge key={userId} color="gray">
                            {user ? user.displayName : userId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleDeleteNotification(selectedNotification.id);
                    setIsViewOpen(false);
                  }}
                  className="flex items-center"
                >
                  <RiDeleteBin5Line className="mr-2 h-4 w-4" />
                  Delete Notification
                </Button>
              </div>
            </div>
          )}
        </DialogPanel>
      </Dialog>
    </div>
  );
}