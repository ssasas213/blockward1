import React from 'react';
import SignupEntryRoute from '@/components/auth/SignupEntryRoute';

// Organisation registration entry (/organisations/signup). The founder may
// be completely unauthenticated and their organisation may not exist yet —
// this routes them into /Signup with /SchoolSetup preserved as the
// post-registration destination, so the flow is: create account → verify →
// create organisation → become its initial administrator. Previously this
// route was a toLogin() stub that bounced every new visitor to Sign In.
export default function OrgsSignup() {
  return <SignupEntryRoute intent="/SchoolSetup" />;
}