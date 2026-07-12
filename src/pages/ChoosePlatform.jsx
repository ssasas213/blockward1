import React, { useEffect } from 'react';

export default function ChoosePlatform() {
  useEffect(() => {
    window.location.href = '/Login';
  }, []);
  return null;
}