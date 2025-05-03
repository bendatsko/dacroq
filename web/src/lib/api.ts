import { API_CONFIG } from './config';

export const getApiUrl = () => {
  // In development, use localhost:8000
  // In production, use the API_CONFIG
  return process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8000'
    : API_CONFIG.BASE_URL;
};

export const api = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${getApiUrl()}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    return response.json();
  },
  
  solve: async (filename: string) => {
    const response = await fetch(`${getApiUrl()}/solve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });
    
    if (!response.ok) {
      throw new Error('Solve failed');
    }
    
    return response.json();
  },
}; 