"use client";

import { useState, useEffect } from "react";
import { RiCloseLine, RiInformationLine, RiAlertLine, RiCheckLine, RiErrorWarningLine } from "@remixicon/react";
import { auth } from "@/lib/auth";

interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  expires_at: string;
  created_at: string;
  created_by: string;
  active: boolean;
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    // Load dismissed announcements from localStorage
    const dismissedIds = localStorage.getItem("dismissedAnnouncements");
    if (dismissedIds) {
      setDismissed(JSON.parse(dismissedIds));
    }

  }, []);

  const dismissAnnouncement = (announcementId: string) => {
    const newDismissed = [...dismissed, announcementId];
    setDismissed(newDismissed);
    localStorage.setItem("dismissedAnnouncements", JSON.stringify(newDismissed));
  };

  if (!announcement || dismissed.includes(announcement.id)) {
    return null;
  }

  const getIcon = () => {
    switch (announcement.type) {
      case 'info':
        return <RiInformationLine className="h-4 w-4" />;
      case 'warning':
        return <RiAlertLine className="h-4 w-4" />;
      case 'error':
        return <RiErrorWarningLine className="h-4 w-4" />;
      case 'success':
        return <RiCheckLine className="h-4 w-4" />;
      default:
        return <RiInformationLine className="h-4 w-4" />;
    }
  };

  const getStyles = () => {
    switch (announcement.type) {
      case 'info':
        return "bg-blue-600 text-white border-blue-700";
      case 'warning':
        return "bg-orange-600 text-white border-orange-700";
      case 'error':
        return "bg-red-600 text-white border-red-700";
      case 'success':
        return "bg-green-600 text-white border-green-700";
      default:
        return "bg-blue-600 text-white border-blue-700";
    }
  };

  return (
    <div className={`w-full ${getStyles()} border-b z-50`}>
      <div className="max-w-7xl mx-auto px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {getIcon()}
            <span className="text-sm font-medium">{announcement.message}</span>
          </div>
          <button
            onClick={() => dismissAnnouncement(announcement.id)}
            className="ml-4 p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss announcement"
          >
            <RiCloseLine className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
} 