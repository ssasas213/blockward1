import React, { useEffect } from 'react';

export default function Signup() {
  useEffect(() => {
    window.location.href = '/Login';
  }, []);
  return null;
}