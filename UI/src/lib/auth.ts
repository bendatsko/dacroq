"use client";

declare global {
  interface Window {
    google: any;
  }
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created?: string;
  last_login?: string;
}

interface AuthResponse {
  user: User;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Debug log to verify the client ID
console.log("🔍 Google Client ID being used:", GOOGLE_CLIENT_ID);

class AuthService {
  private user: User | null = null;
  private listeners: ((user: User | null) => void)[] = [];
  private userInfoCache: { [accessToken: string]: any } = {};

  constructor() {
    // Only load from storage in browser environment
    if (typeof window !== 'undefined') {
      this.loadUserFromStorage();
    }
    // Initialize Google Auth asynchronously without blocking
    this.initializeGoogleAuth().catch(console.error);
  }

  private async initializeGoogleAuth() {
    if (typeof window === 'undefined') return;
    
    return new Promise<void>((resolve) => {
      if (window.google) {
        resolve();
        return;
      }

      // Optimize script loading
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        console.error('Failed to load Google Identity Services');
        resolve(); // Still resolve to not block the app
      };
      
      // Add preload hint for faster loading
      const preload = document.createElement('link');
      preload.rel = 'preload';
      preload.href = 'https://accounts.google.com/gsi/client';
      preload.as = 'script';
      document.head.appendChild(preload);
      
      document.head.appendChild(script);
    });
  }

  private loadUserFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        this.user = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
      localStorage.removeItem('user');
    }
  }

  private saveUserToStorage(user: User) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('user', JSON.stringify(user));
  }

  private clearUserFromStorage() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('user');
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.user));
  }

  public onAuthStateChanged(callback: (user: User | null) => void) {
    this.listeners.push(callback);
    // Immediately call with current state
    callback(this.user);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  public async signInWithGoogle(): Promise<User> {
    return new Promise((resolve, reject) => {
      if (!window.google) {
        reject(new Error('Google Identity Services not loaded'));
        return;
      }

      // Use the standard OAuth2 token flow - more reliable
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile',
        callback: async (response: any) => {
          try {
            if (response.error) {
              throw new Error(response.error);
            }
            
            // Get user info using the access token
            const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`);
            
            if (!userInfoResponse.ok) {
              throw new Error('Failed to get user info from Google');
            }
            
            const userInfo = await userInfoResponse.json();
            
            // Create a token for our backend (base64 encoded user info)
            const token = btoa(JSON.stringify({
              sub: userInfo.id,
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              iss: 'accounts.google.com'
            }));
            
            const user = await this.verifyGoogleToken(token);
            this.user = user;
            this.saveUserToStorage(user);
            this.notifyListeners();
            resolve(user);
          } catch (error) {
            console.error("❌ Error in OAuth callback:", error);
            reject(error);
          }
        }
      }).requestAccessToken();
    });
  }

  public async signInWithGooglePopup(): Promise<User> {
    if (typeof window === 'undefined') {
      throw new Error('Google sign-in is only available in browser environment');
    }
    
    // Use the same method as signInWithGoogle
    return this.signInWithGoogle();
  }

  private async verifyGoogleToken(token: string): Promise<User> {
    const response = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Authentication failed');
    }

    const data: AuthResponse = await response.json();
    return data.user;
  }

  public async signOut(): Promise<void> {
    const userEmail = this.user?.email;
    
    this.user = null;
    this.userInfoCache = {}; // Clear cache for security
    this.clearUserFromStorage();
    this.notifyListeners();
    
    // Clear Google session more efficiently
    if (typeof window !== 'undefined' && window.google) {
      // Disable auto-select to prevent automatic re-authentication
      window.google.accounts.id.disableAutoSelect();
      
      // Also revoke the current session if available
      try {
        if (userEmail) {
          window.google.accounts.id.revoke(userEmail, () => {
            console.log('Google session revoked');
          });
        }
      } catch (error) {
        // Silent fail - not critical for sign out
      }
    }
  }

  public getCurrentUser(): User | null {
    return this.user;
  }

  public async checkMaintenanceMode(): Promise<{ maintenanceMode: boolean; message?: string }> {
    try {
      const response = await fetch(`${API_BASE}/system/settings`);
      if (response.ok) {
        const data = await response.json();
        return {
          maintenanceMode: data.settings?.maintenanceMode === 'true',
          message: data.settings?.maintenanceMessage
        };
      }
    } catch (error) {
      console.warn('Could not check maintenance mode:', error);
    }
    return { maintenanceMode: false };
  }

  // API methods for user management (admin only)
  public async getUsers(): Promise<User[]> {
    if (!this.user) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_BASE}/users`, {
      headers: {
        'Authorization': `Bearer ${this.user.id}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get users');
    }

    const data = await response.json();
    return data.users;
  }

  public async updateUserRole(userId: string, role: string): Promise<void> {
    if (!this.user) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.user.id}`,
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    if (!this.user) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.user.id}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
  }

  public async getUserStats(): Promise<{ totalUsers: number; activeUsers: number; adminUsers: number }> {
    if (!this.user) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_BASE}/users/stats`, {
      headers: {
        'Authorization': `Bearer ${this.user.id}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user stats');
    }

    return response.json();
  }

  public async updateSystemSettings(settings: Record<string, any>): Promise<void> {
    if (!this.user) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_BASE}/system/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.user.id}`,
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update settings');
    }
  }

  public async createAnnouncement(announcement: {
    message: string;
    type: string;
    expires_at: string;
  }): Promise<void> {
    if (!this.user) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_BASE}/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.user.id}`,
      },
      body: JSON.stringify(announcement),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create announcement');
    }
  }

  public async getAnnouncements(): Promise<any[]> {
    const response = await fetch(`${API_BASE}/announcements`);

    if (!response.ok) {
      throw new Error('Failed to get announcements');
    }

    const data = await response.json();
    return data.announcements;
  }
}

// Create singleton instance
export const auth = new AuthService();

// Export types
export type { User }; 