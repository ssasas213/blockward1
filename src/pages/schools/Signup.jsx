import React, { useEffect } from 'react';
import { toLogin } from '@/lib/authRedirectGuard';

export default function SchoolsSignup() {
  useEffect(() => {
    toLogin();
  }, []);
  return null;
}