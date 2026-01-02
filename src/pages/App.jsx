import React from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';

export default function App({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}