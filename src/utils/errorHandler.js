// Global error handler for ResizeObserver
export const initErrorHandling = () => {
  // Handle ResizeObserver loop errors
  const originalErrorHandler = window.onerror;
  
  window.onerror = function(message, source, lineno, colno, error) {
    if (typeof message === 'string' && message.includes('ResizeObserver')) {
      console.warn('ResizeObserver error (harmless):', message);
      return true; // Prevent default error handling
    }
    
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    
    return false;
  };

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && 
        event.reason.message.includes('ResizeObserver')) {
      event.preventDefault();
      console.warn('ResizeObserver promise rejection (harmless):', event.reason);
    }
  });
};

// Call this in your main App.js or index.js