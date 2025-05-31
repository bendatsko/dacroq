export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'destructive';

export type ToastOptions = {
  title?: string;
  description: string;
  variant?: ToastType;
};

// Simple toast interface to match usage across the app
export const toast = (options: ToastOptions) => {
  const { title, description, variant = 'info' } = options;
  
  // Log to console for debugging
  console.log(`[TOAST ${variant.toUpperCase()}]${title ? ` ${title}:` : ''} ${description}`);
  
  // Create and show a visual toast notification
  const toastElement = document.createElement('div');
  toastElement.className = `fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg border transition-all duration-300 transform translate-x-full`;
  
  // Style based on variant
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    destructive: 'bg-red-50 border-red-200 text-red-800'
  };
  
  toastElement.className += ` ${styles[variant]}`;
  
  // Add content
  toastElement.innerHTML = `
    <div class="flex items-start">
      <div class="flex-1">
        ${title ? `<div class="font-medium text-sm">${title}</div>` : ''}
        <div class="text-sm ${title ? 'mt-1' : ''}">${description}</div>
      </div>
      <button class="ml-3 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>
  `;
  
  // Add to DOM
  document.body.appendChild(toastElement);
  
  // Animate in
  setTimeout(() => {
    toastElement.classList.remove('translate-x-full');
  }, 10);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toastElement.classList.add('translate-x-full');
    setTimeout(() => {
      if (toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement);
      }
    }, 300);
  }, 5000);
};
