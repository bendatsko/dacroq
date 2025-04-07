import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth, UserRecord } from "firebase/auth";
import { db } from "@/lib/firebase";
import { AdminUser } from "./schema";

// Function to fetch admin users with fallback
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  try {
    // Try to fetch from Firestore
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);

    const adminUsers: AdminUser[] = [];

    if (!usersSnapshot.empty) {
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        adminUsers.push({
          uid: doc.id,
          displayName: userData.displayName || "Unknown User",
          email: userData.email || "",
          joinDate: userData.createdAt ? new Date(userData.createdAt.toDate()).toISOString() : new Date().toISOString(),
          lastOnlineDate: userData.lastLogin ? new Date(userData.lastLogin.toDate()).toISOString() : null,
          testsRun: userData.testsRun || 0,
          accountState: userData.disabled ? "disabled" : "enabled",
          role: userData.role || "user",
          photoURL: userData.photoURL || undefined
        });
      });
      return adminUsers;
    } else {
      // Fallback to localStorage if no users in Firestore
      return getLocalUser();
    }
  } catch (error) {
    console.error("Error fetching admin users:", error);
    // Fallback to localStorage if Firestore fails
    return getLocalUser();
  }
}

// Get local user from localStorage as fallback
function getLocalUser(): AdminUser[] {
  try {
    const userJson = localStorage.getItem("user");
    if (!userJson) return [];

    const user = JSON.parse(userJson);

    return [{
      uid: user.uid || "unknown",
      displayName: user.displayName || "Current User",
      email: user.email || "",
      joinDate: new Date().toISOString(), // We don't have this info in localStorage
      lastOnlineDate: new Date().toISOString(),
      testsRun: 0, // Default value
      accountState: "enabled", // Default value
      role: "admin", // Assume current user is admin for demo
      photoURL: user.photoURL
    }];
  } catch (error) {
    console.error("Error getting local user:", error);
    return [];
  }
}

// Update user role
export async function updateUserRole(uid: string, role: "user" | "moderator" | "admin"): Promise<boolean> {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { role });
    return true;
  } catch (error) {
    console.error("Error updating user role:", error);
    return false;
  }
}

// Update user account state
export async function updateUserAccountState(uid: string, disabled: boolean): Promise<boolean> {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { disabled });
    return true;
  } catch (error) {
    console.error("Error updating account state:", error);
    return false;
  }
}