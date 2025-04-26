export interface User {
  id?: string;
  name?: string;
  email?: string;
  photoURL?: string;
}

export interface TestRun {
  id: string;
  name: string;
  chipType: "3SAT" | "LDPC" | "HARDWARE";
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  results?: any;
  error?: string;
  metadata?: {
    createdBy?: User;
    config?: any;
  };
}
