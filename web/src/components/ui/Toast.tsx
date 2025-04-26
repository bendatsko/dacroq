"use client";

import { useState, useEffect } from 'react';
import { RiInformationLine, RiCloseLine } from '@remixicon/react';

export interface ToastProps {
  id: string;
  message: string;
  duration?: number; // in milliseconds
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose?: (id: string) => void;
}

export const Toast = ({ id, message, duration = 10000, type = 'info', onClose }: ToastProps) => {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    if (duration > 0) {
      const startTime = Date.now();
      const endTime = startTime + duration;
      
      interval = setInterval(() => {
        const now = Date.now();
        const timeLeft = endTime - now;
        const percentage = Math.max(0, (timeLeft / duration) * 100);
        
        setProgress(percentage);
        
        if (percentage <= 0) {
          clearInterval(interval);
          handleClose();
        }
      }, 100);
      
      timer = setTimeout(() => {
        handleClose();
      }, duration);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [duration]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      if (onClose) onClose(id);
    }, 300); // Animation duration
  };

  // Skip render if not visible
  if (!visible) return null;

  const bgColors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  const iconColor = {
    info: 'text-blue-200',
    success: 'text-green-200',
    warning: 'text-yellow-200',
    error: 'text-red-200'
  };

  return (
    <div 
      className={`w-full max-w-md flex items-center rounded-lg shadow-lg overflow-hidden
                  ${visible ? 'animate-slideIn' : 'animate-slideOut'}
                  ${type === 'info' ? 'bg-blue-600' :
                    type === 'success' ? 'bg-green-600' :
                    type === 'warning' ? 'bg-yellow-600' :
                    'bg-red-600'}`}
      role="alert"
    >
      <div className="flex-shrink-0 p-4">
        <RiInformationLine className={`h-6 w-6 ${iconColor[type]}`} />
      </div>
      <div className="flex-1 p-4 text-white">
        {message}
      </div>
      <button 
        onClick={handleClose}
        className="flex-shrink-0 p-4 text-white hover:text-gray-200 focus:outline-none"
      >
        <RiCloseLine className="h-5 w-5" />
      </button>
      
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-white bg-opacity-30">
        <div 
          className={`h-full ${bgColors[type]}`}
          style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
        ></div>
      </div>
    </div>
  );
};
