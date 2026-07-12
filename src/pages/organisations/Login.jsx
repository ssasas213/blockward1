import React, { useEffect } from 'react';

export default function OrgsLogin() {
  useEffect(() => {
    window.location.href = '/Login';
  }, []);
  return null;
}