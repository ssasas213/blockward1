import React, { useEffect } from 'react';

export default function Signup() {
  // Redirect to platform choice — users must select Schools or Organisations first
  useEffect(() => {
    window.location.href = '/ChoosePlatform';
  }, []);
  return null;
}