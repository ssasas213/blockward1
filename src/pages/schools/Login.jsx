import React, { useEffect } from 'react';

export default function SchoolsLogin() {
  useEffect(() => {
    window.location.href = '/Login';
  }, []);
  return null;
}