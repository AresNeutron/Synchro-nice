import { useContext, createContext } from "react";
import type { AppContextType } from "../types/context_interface";


export const AppContext = createContext<AppContextType | undefined>(undefined);

// 4. Hook personalizado para consumir el contexto
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};