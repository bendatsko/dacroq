"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AdminPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "notifications"),
        orderBy("date", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotifications(data as any[]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const createNotification = async () => {
    if (!newTitle.trim() || !newMessage.trim()) return;
    try {
      await addDoc(collection(db, "notifications"), {
        title: newTitle,
        message: newMessage,
        date: serverTimestamp(),
      });
      setNewTitle("");
      setNewMessage("");
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), {
        deleted: true,
        deletedAt: serverTimestamp(),
      });
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleServer = async (serverType: string, action: string) => {
    try {
      await fetch(`/api/admin/server/${serverType}/${action}`, { method: 'POST' });
      // Optionally handle response status
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="p-6 space-y-6">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Notifications</h2>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              className="border rounded px-2 py-1"
            />
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message"
              className="border rounded px-2 py-1"
            />
            <Button onClick={createNotification}>Create</Button>
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : notifications.length === 0 ? (
          <p>No notifications</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHead>
            <TableBody>
              {notifications.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{n.title}</TableCell>
                  <TableCell>{n.message}</TableCell>
                  <TableCell>
                    {n.date?.toDate
                      ? n.date.toDate().toLocaleString()
                      : ''}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" onClick={() => deleteNotification(n.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-2">Server Control</h2>
      </Card>
    </main>
  );
}
