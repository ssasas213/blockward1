import React, { useEffect } from 'react';
import { toLogin } from '@/lib/authRedirectGuard';

export default function OrgsSignup() {
  useEffect(() => {
    toLogin();
  }, []);
  return null;
}