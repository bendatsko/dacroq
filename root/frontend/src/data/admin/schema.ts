export interface AdminUser {
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