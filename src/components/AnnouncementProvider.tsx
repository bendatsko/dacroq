"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Toast, ToastProps } from '@/components/ui/Toast';

// API endpoint - using the same as in the main app
const API_BASE = "https://medusa.bendatsko.com";

// Interface for an announcement
export interface Announcement {
  id: string;
  message: string;
  admin_user?: string;
  created: string;
  expires?: string;
  is_active: boolean;
}

// Context type definitions
interface AnnouncementContextType {
  announcements: Announcement[];
  toasts: ToastProps[];
  dismissAnnouncement: (id: string) => void;
  dismissAllAnnouncements: () => void;
  addToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', duration?: number) => void;
}

// Create the context with default values
const AnnouncementContext = createContext<AnnouncementContextType>({
  announcements: [],
  toasts: [],
  dismissAnnouncement: () => {},
  dismissAllAnnouncements: () => {},
  addToast: () => {},
});

// Custom hook to use the announcement context
export const useAnnouncements = () => useContext(AnnouncementContext);

export const AnnouncementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // Fetch announcements from the API
  const fetchAnnouncements = useCallback(async () => {
    try {
      const now = Date.now();
      
      // Only fetch once every 30 seconds
      if (now - lastFetchTime < 30000) {
        return;
      }
      
      setLastFetchTime(now);
      
      const response = await fetch(`${API_BASE}/api/announcements`);
      if (!response.ok) {
        throw new Error(`Error fetching announcements: ${response.statusText}`);
      }
      
      const data: Announcement[] = await response.json();
      
      // Convert to local toast data if needed
      if (data && data.length > 0) {
        // Filter out announcements we already have
        const newAnnouncements = data.filter(
          announcement => !announcements.some(a => a.id === announcement.id)
        );
        
        if (newAnnouncements.length > 0) {
          // Add to announcements state
          setAnnouncements(prev => [...prev, ...newAnnouncements]);
          
          // Add toast notifications for new announcements
          newAnnouncements.forEach(announcement => {
            addToast(announcement.message, 'info', 10000, announcement.id);
          });
        }
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  }, [announcements, lastFetchTime]);

  // Initialize and set up polling
  useEffect(() => {
    // Initial fetch
    fetchAnnouncements();
    
    // Set up polling
    const interval = setInterval(fetchAnnouncements, 30000);
    
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  // Function to dismiss a specific announcement
  const dismissAnnouncement = useCallback(async (id: string) => {
    try {
      // Remove from local state
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      
      // Remove related toast if exists
      setToasts(prev => prev.filter(t => t.id !== id));
      
      // Send to backend to mark as inactive
      await fetch(`${API_BASE}/api/announcements/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error dismissing announcement ${id}:`, error);
    }
  }, []);

  // Function to dismiss all announcements
  const dismissAllAnnouncements = useCallback(() => {
    // Make a copy of the current announcements for API processing
    const currentAnnouncements = [...announcements];
    
    // Clear local state
    setAnnouncements([]);
    setToasts([]);
    
    // Mark each announcement as inactive in the backend
    currentAnnouncements.forEach(async (announcement) => {
      try {
        await fetch(`${API_BASE}/api/announcements/${announcement.id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error(`Error dismissing announcement ${announcement.id}:`, error);
      }
    });
  }, [announcements]);

  // Function to add a new toast
  const addToast = useCallback((
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info', 
    duration: number = 10000,
    id?: string
  ) => {
    const toastId = id || `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setToasts(prev => [
      ...prev,
      {
        id: toastId,
        message,
        type,
        duration,
        onClose: (id) => {
          setToasts(prev => prev.filter(toast => toast.id !== id));
        }
      }
    ]);
  }, []);

  // Provide the context
  return (
    <AnnouncementContext.Provider
      value={{
        announcements,
        toasts,
        dismissAnnouncement,
        dismissAllAnnouncements,
        addToast
      }}
    >
      {children}
      
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed top-5 right-5 z-50 flex flex-col space-y-4">
          {toasts.map((toast) => (
            <Toast key={toast.id} {...toast} />
          ))}
        </div>
      )}
    </AnnouncementContext.Provider>
  );
};
