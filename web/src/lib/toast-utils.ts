export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'destructive';

export type ToastOptions = {
  title?: string;
  description: string;
  variant?: ToastType;
};

// Simple toast interface to match usage across the app
export const toast = (options: ToastOptions) => {
  // For now, we'll just log to console, but this could be expanded to use a more
  // sophisticated toast system like react-hot-toast or react-toastify
  const { title, description, variant = 'info' } = options;
  
  console.log(`[TOAST ${variant.toUpperCase()}]${title ? ` ${title}:` : ''} ${description}`);
  
  // In a real implementation, we would show a toast notification here
  // This is a temporary solution until a proper toast system is implemented
};
