import React, { useEffect } from 'react';
import { toLogin } from '@/lib/authRedirectGuard';

export default function SchoolsLogin() {
  useEffect(() => {
    toLogin();
  }, []);
  return null;
}