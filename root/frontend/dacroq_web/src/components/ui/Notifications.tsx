// Notification.tsx - Enhanced component with Firebase integration
'use client';

import React, { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/Popover";
import { cx, focusRing } from "@/lib/utils";
import { RiNotification2Line } from "@remixicon/react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "../Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Tabs";

// Firebase imports
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
  getDoc,
  getDocs,
  setDoc
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
}

interface NotificationUserState {
  notificationId: string;
  userId: string;
  read: boolean;
  createdAt: any; // Firestore timestamp
  readAt?: any; // Firestore timestamp
}

const formatDate = (firestoreTimestamp: any): string => {
  if (!firestoreTimestamp) return "Unknown date";

  const date = firestoreTimestamp.toDate ? firestoreTimestamp.toDate() : new Date(firestoreTimestamp);
  const now = new Date();
  const distance = formatDistanceToNow(date, { addSuffix: true });

  return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000
    ? distance
    : format(date, "d MMM yyyy");
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "alert":
      return "💡";
    case "update":
      return "🔄";
    case "info":
      return "ℹ️";
    default:
      return "📢";
  }
};

const NotificationItem = ({
                            notification,
                            read,
                            onMarkAsRead
                          }: {
  notification: Notification,
  read: boolean,
  onMarkAsRead: (id: string) => void
}) => {
  const { id, title, message, date, type } = notification;

  return (
    <li className="py-2.5">
      <div
        className="relative block rounded-md px-1 py-1.5 hover:bg-gray-100/90 focus:outline-none hover:dark:bg-gray-900"
      >
        {/* Extend touch target to entire field */}
        <span aria-hidden="true" className="absolute inset-0" />
        <div className="flex gap-2">
          <span className="text-lg">{getNotificationIcon(type)}</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
              {!read && (
                <span
                  aria-hidden="true"
                  className="mb-px mr-1.5 inline-flex size-2 shrink-0 rounded-full bg-blue-500 sm:text-sm dark:bg-blue-500"
                />
              )}
              {title || "System Notification"}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200">{message}</p>
            <div className="mt-2.5 flex justify-between items-center">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {formatDate(date)}
              </p>
              {!read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(id);
                  }}
                >
                  Mark as read
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

const NotificationList = ({
                            notifications,
                            showAll = false,
                            readStatus,
                            onMarkAsRead
                          }: {
  notifications: {notification: Notification, read: boolean}[],
  showAll?: boolean,
  readStatus: {[key: string]: boolean},
  onMarkAsRead: (id: string) => void
}) => {
  // Filter the notifications based on the showAll parameter
  const filteredNotifications = showAll
    ? notifications
    : notifications.filter(({ read }) => !read);

  if (filteredNotifications.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-gray-500 dark:text-gray-400">No notifications</p>
      </div>
    );
  }

  return (
    <ol
      aria-label={showAll ? "All notifications" : "Unread notifications"}
      className="flex max-h-96 flex-col divide-y divide-gray-200 overflow-y-auto dark:divide-gray-800"
    >
      {filteredNotifications.map(({ notification, read }) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          read={read}
          onMarkAsRead={onMarkAsRead}
        />
      ))}
    </ol>
  );
};

export function Notifications() {
  const [notifications, setNotifications] = useState<{notification: Notification, read: boolean}[]>([]);
  const [readStatus, setReadStatus] = useState<{[key: string]: boolean}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current user
  const user = auth.currentUser;

  // Load notifications from Firestore
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const notificationsRef = collection(db, "notifications");

    // Query for global notifications - REMOVED the orderBy to avoid needing a composite index
    const notificationsQuery = query(
      notificationsRef,
      where("global", "==", true)
    );

    // Listen for notifications
    const unsubscribe = onSnapshot(
      notificationsQuery,
      async (snapshot) => {
        try {
          // Get user notification states
          const userNotificationsRef = collection(db, "users", user.uid, "notifications");
          const userNotificationsSnap = await getDocs(userNotificationsRef);

          const userNotificationsMap: {[key: string]: NotificationUserState} = {};
          userNotificationsSnap.forEach(doc => {
            userNotificationsMap[doc.id] = doc.data() as NotificationUserState;
          });

          // Process notifications and sort them manually by date
          const notificationsData = snapshot.docs.map(doc => {
            const notificationData = doc.data() as Notification;
            const notificationId = doc.id;

            // Check if user has read this notification
            const userNotificationState = userNotificationsMap[notificationId];
            const isRead = userNotificationState?.read || false;

            // Update read status map
            setReadStatus(prev => ({
              ...prev,
              [notificationId]: isRead
            }));

            return {
              notification: {
                id: notificationId,
                ...notificationData
              },
              read: isRead
            };
          });

          // Sort notifications by date (newest first)
          notificationsData.sort((a, b) => {
            const dateA = a.notification.date ?
              (a.notification.date.toDate ? a.notification.date.toDate() : new Date(a.notification.date)) :
              new Date(0);
            const dateB = b.notification.date ?
              (b.notification.date.toDate ? b.notification.date.toDate() : new Date(b.notification.date)) :
              new Date(0);
            return dateB.getTime() - dateA.getTime();
          });

          setNotifications(notificationsData);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching notification states:", error);
          setError("Failed to load notification status");
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        setError("Failed to load notifications");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Mark a single notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      if (!user) return;

      // Update user notification state in Firestore
      const notificationRef = doc(db, "users", user.uid, "notifications", notificationId);

      // Check if the notification state exists first
      const notificationSnap = await getDoc(notificationRef);

      if (notificationSnap.exists()) {
        // Update existing document
        await updateDoc(notificationRef, {
          read: true,
          readAt: new Date()
        });
      } else {
        // Create new document - fixed to use setDoc instead of updateDoc for new documents
        await setDoc(notificationRef, {
          notificationId,
          userId: user.uid,
          read: true,
          createdAt: new Date(),
          readAt: new Date()
        });
      }

      // Update local state
      setReadStatus(prev => ({
        ...prev,
        [notificationId]: true
      }));

      // Update notifications state
      setNotifications(prev =>
        prev.map(item =>
          item.notification.id === notificationId
            ? { ...item, read: true }
            : item
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      setError("Failed to mark notification as read");
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      if (!user) return;

      const batch = writeBatch(db);

      // Filter to only unread notifications
      const unreadNotifications = notifications
        .filter(item => !item.read)
        .map(item => item.notification.id);

      if (unreadNotifications.length === 0) return;

      // Update each notification state in the batch
      unreadNotifications.forEach(notificationId => {
        const notificationRef = doc(db, "users", user.uid, "notifications", notificationId);
        batch.set(notificationRef, {
          notificationId,
          userId: user.uid,
          read: true,
          createdAt: new Date(),
          readAt: new Date()
        });
      });

      // Commit the batch
      await batch.commit();

      // Update local states
      const newReadStatus = { ...readStatus };
      unreadNotifications.forEach(id => {
        newReadStatus[id] = true;
      });
      setReadStatus(newReadStatus);

      // Update notifications state
      setNotifications(prev =>
        prev.map(item =>
          unreadNotifications.includes(item.notification.id)
            ? { ...item, read: true }
            : item
        )
      );
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      setError("Failed to mark all notifications as read");
    }
  };

  // Calculate unread count
  const unreadCount = notifications.filter(({ read }) => !read).length;

  if (loading) {
    return (
      <Button
        variant="ghost"
        aria-label="loading notifications"
        className={cx(
          focusRing,
          "group rounded-full p-1 hover:bg-gray-100",
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-gray-300 bg-white p-1">
          <div className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
        </span>
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-label="open notifications"
          className={cx(
            focusRing,
            "group rounded-full p-1 hover:bg-gray-100 data-[state=open]:bg-gray-100 hover:dark:bg-gray-400/10 data-[state=open]:dark:bg-gray-400/10",
          )}
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-900 hover:dark:bg-gray-400/10">
            {unreadCount > 0 && (
              <span
                className="absolute right-2.5 top-2.5 size-2 shrink-0 rounded-full bg-blue-500"
                aria-hidden="true"
              />
            )}
            <RiNotification2Line
              className="-ml-px size-4 shrink-0 text-gray-700 group-hover:text-gray-900 dark:text-gray-300 group-hover:dark:text-gray-50"
              aria-hidden="true"
            />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-20 ml-2 max-w-[95vw] px-3 sm:ml-0 sm:max-w-sm"
      >
        <div className="flex items-center justify-between gap-16">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <Button variant="ghost" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>

        {error && (
          <div className="mt-2 p-2 bg-red-50 text-red-600 rounded-md text-sm">
            {error}
          </div>
        )}

        <Tabs defaultValue="unread" className="mt-4">
          <TabsList className="grid w-full grid-cols-2" variant="solid">
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <div className="mt-2">
            <TabsContent value="unread">
              <NotificationList
                notifications={notifications}
                readStatus={readStatus}
                onMarkAsRead={handleMarkAsRead}
              />
            </TabsContent>
            <TabsContent value="all">
              <div className="relative">
                <NotificationList
                  notifications={notifications}
                  showAll
                  readStatus={readStatus}
                  onMarkAsRead={handleMarkAsRead}
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white dark:to-gray-950"
                  aria-hidden="true"
                />
              </div>
              {notifications.length > 10 && (
                <Button variant="secondary" className="mt-2 w-full">
                  View all
                </Button>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}