import React from 'react';
import SignupEntryRoute from '@/components/auth/SignupEntryRoute';

// Staff account registration entry (/schools/signup). A NEW teacher must be
// able to reach this while unauthenticated — it routes into /Signup, where
// the staff join code field provisions a teacher membership (pending admin
// approval). Previously this route was a toLogin() stub that bounced every
// new visitor straight back to Sign In.
export default function SchoolsSignup() {
  return <SignupEntryRoute />;
}