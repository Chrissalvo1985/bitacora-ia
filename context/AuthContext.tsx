import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../services/authService';
import { registerUser, loginUser, verifySession, logoutUser as logoutUserService, updateUser as updateUserService } from '../services/authService';
import { initAuthTables } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUserProfile: (updates: { name?: string; email?: string; gender?: 'male' | 'female' | 'other' }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'bitacora_auth_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // Initialize auth tables
      await initAuthTables();
      
      // Check for existing session
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        const verifiedUser = await verifySession(token);
        if (verifiedUser) {
          setUser(verifiedUser);
        } else {
          // Token expired or invalid
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { user: loggedUser, token } = await loginUser(email, password);
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setUser(loggedUser);
    } catch (error: any) {
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const { user: newUser, token } = await registerUser(email, password, name);
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setUser(newUser);
    } catch (error: any) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        await logoutUserService(token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
    }
  };

  const refreshAuth = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      const verifiedUser = await verifySession(token);
      if (verifiedUser) {
        setUser(verifiedUser);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
      }
    }
  };

  const updateUserProfile = async (updates: { name?: string; email?: string; gender?: 'male' | 'female' | 'other' }) => {
    if (!user) throw new Error('Usuario no autenticado');
    
    try {
      await updateUserService(user.id, updates);
      // Update local user state
      setUser(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshAuth,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

