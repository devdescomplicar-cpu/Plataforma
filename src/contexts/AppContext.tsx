import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextType {
  hideValues: boolean;
  toggleHideValues: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hideValues, setHideValues] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleHideValues = () => setHideValues(prev => !prev);

  return (
    <AppContext.Provider value={{ hideValues, toggleHideValues, sidebarOpen, setSidebarOpen }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Utility component to display values with hide functionality
export function HiddenValue({ 
  value, 
  prefix = '', 
  suffix = '' 
}: { 
  value: string | number; 
  prefix?: string;
  suffix?: string;
}) {
  const { hideValues } = useApp();
  
  if (hideValues) {
    return <span className="value-hidden">{prefix}•••••{suffix}</span>;
  }
  
  return <span>{prefix}{value}{suffix}</span>;
}
