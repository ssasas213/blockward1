import React from 'react';
import SignupEntryRoute from '@/components/auth/SignupEntryRoute';

// Organisation registration entry (/organisations/signup). The founder may
// be completely unauthenticated and their organisation may not exist yet —
// this routes them into /Signup with /register-organisation preserved as the
// post-registration destination: create account → verify → register the
// organisation → become its Owner.
export default function OrgsSignup() {
  return <SignupEntryRoute intent="/register-organisation" />;
}