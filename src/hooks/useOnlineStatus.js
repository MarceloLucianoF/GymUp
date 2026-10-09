import { useState, useEffect } from 'react';

const read = () => (typeof navigator === 'undefined' || navigator.onLine !== false);

// true quando há conexão (eventos online/offline do navegador).
export function useOnlineStatus() {
  const [online, setOnline] = useState(read);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export default useOnlineStatus;
