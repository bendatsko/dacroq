import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

export type FileType = "cnf" | "csv" | "zip" | "unknown";
export type FileStatus = "pending" | "processing" | "completed" | "error";

export interface FileItem {
    id: string;
    name: string;
    type: FileType;
    size: number;
    status: FileStatus;
    progress: number;
    content?: string;
    batchName?: string;
    instanceIdx?: string;
    jsonContent?: string;
    error?: string;
    isExtracted?: boolean;
    originalZipName?: string;
}

export interface FolderItem {
    id: string;
    name: string;
    files: FileItem[];
    isOpen: boolean;
}

export interface Submission {
    timestamp: number;
    files: FileItem[];
    metadata: {
        solverName: string;
        numSweeps: string;
        numReplicas: string;
        hardware: string;
        cutoffType: string;
        cutoff: string;
        runsAttempted: string;
        runsSolved: string;
        preRuntimeSeconds: string;
        runtimeSeconds: string;
        nUnsatClauses: string;
    };
}

type FileStoreState = {
    files: FileItem[];
    folders: FolderItem[];
    selectedFile: FileItem | null;
    submissions: Record<string, Submission>;
    activeSubmission: string | null;
    generatedJsons: Record<string, { content: string; timestamp: number }>;
    activeJsonTab: string | null;
    isProcessing: boolean;
    progress: number;
    error: string | null;
};

type FileStoreActions = {
    setFiles: (files: FileItem[]) => void;
    setFolders: (folders: FolderItem[]) => void;
    setSelectedFile: (file: FileItem | null) => void;
    updateFile: (id: string, updates: Partial<FileItem>) => void;
    addFiles: (newFiles: FileItem[]) => void;
    removeFile: (id: string) => void;
    addSubmission: (submission: Submission) => void;
    removeSubmission: (id: string) => void;
    setActiveSubmission: (id: string | null) => void;
    addGeneratedJson: (id: string, content: string) => void;
    removeGeneratedJson: (id: string) => void;
    setActiveJsonTab: (id: string | null) => void;
    setProcessing: (processing: boolean) => void;
    setProgress: (progress: number) => void;
    setError: (error: string | null) => void;
};

type FileStore = FileStoreState & FileStoreActions;

export const useFileStore = create<FileStore>()(
    persist(
        (set: StateCreator<FileStore>) => ({
            // File Management
            files: [],
            folders: [],
            selectedFile: null,
            setFiles: (files: FileItem[]) => set({ files }),
            setFolders: (folders: FolderItem[]) => set({ folders }),
            setSelectedFile: (file: FileItem | null) => set({ selectedFile: file }),
            updateFile: (id: string, updates: Partial<FileItem>) =>
                set((state: FileStore) => ({
                    files: state.files.map((f: FileItem) =>
                        f.id === id ? { ...f, ...updates } : f
                    ),
                })),
            addFiles: (newFiles: FileItem[]) =>
                set((state: FileStore) => ({ files: [...state.files, ...newFiles] })),
            removeFile: (id: string) =>
                set((state: FileStore) => ({
                    files: state.files.filter((f: FileItem) => f.id !== id),
                })),

            // Submission History
            submissions: {},
            activeSubmission: null,
            addSubmission: (submission: Submission) =>
                set((state: FileStore) => ({
                    submissions: {
                        ...state.submissions,
                        [`submission_${submission.timestamp}`]: submission,
                    },
                })),
            removeSubmission: (id: string) =>
                set((state: FileStore) => {
                    const { [id]: removed, ...rest } = state.submissions;
                    return { submissions: rest };
                }),
            setActiveSubmission: (id: string | null) => set({ activeSubmission: id }),

            // Generated JSONs
            generatedJsons: {},
            activeJsonTab: null,
            addGeneratedJson: (id: string, content: string) =>
                set((state: FileStore) => ({
                    generatedJsons: {
                        ...state.generatedJsons,
                        [id]: { content, timestamp: Date.now() },
                    },
                })),
            removeGeneratedJson: (id: string) =>
                set((state: FileStore) => {
                    const { [id]: removed, ...rest } = state.generatedJsons;
                    return { generatedJsons: rest };
                }),
            setActiveJsonTab: (id: string | null) => set({ activeJsonTab: id }),

            // Processing State
            isProcessing: false,
            progress: 0,
            error: null,
            setProcessing: (processing: boolean) => set({ isProcessing: processing }),
            setProgress: (progress: number) => set({ progress }),
            setError: (error: string | null) => set({ error }),
        }),
        {
            name: 'file-storage',
            partialize: (state: FileStore) => ({
                submissions: state.submissions,
                generatedJsons: state.generatedJsons,
            }),
        }
    )
) 