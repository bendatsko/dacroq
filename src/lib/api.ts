export const getApiUrl = () => {
  // In development, use localhost:8080
  // In production, use dacroq.eecs.umich.edu/api
  return process.env.NODE_ENV === 'development' 
    ? process.env.NEXT_PUBLIC_API_URL 
    : process.env.NEXT_PUBLIC_API_URL_PRODUCTION;
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