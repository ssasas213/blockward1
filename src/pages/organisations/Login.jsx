import React, { useEffect } from 'react';
import { toLogin } from '@/lib/authRedirectGuard';

export default function OrgsLogin() {
  useEffect(() => {
    toLogin();
  }, []);
  return null;
}