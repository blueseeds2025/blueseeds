'use client';

import { createContext, useContext, ReactNode } from 'react';

// ============================================================================
// Auth Context 타입
// ============================================================================

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: 'owner' | 'teacher';
  displayName: string;
}

interface AuthContextType {
  user: AuthUser | null;
}

// ============================================================================
// Context 생성
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Provider 컴포넌트
// ============================================================================

interface AuthProviderProps {
  user: AuthUser | null;
  children: ReactNode;
}

export function AuthProvider({ user, children }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 편의 함수: user가 있다고 보장할 때 사용
export function useRequiredAuth(): AuthUser {
  const { user } = useAuth();
  if (!user) {
    throw new Error('User is required but not found');
  }
  return user;
}
