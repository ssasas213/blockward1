import React from 'react';
import { ShieldAlert } from 'lucide-react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="max-w-md w-full p-8 bg-card rounded-xl shadow-card border border-border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-warning/10 border border-warning/20">
            <ShieldAlert className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Access restricted</h1>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Your account doesn't have access to this application yet. If you were invited, accept the
            invitation from your email — otherwise contact the person who sent it to you.
          </p>
          <div className="p-4 bg-secondary rounded-lg border border-border text-sm text-muted-foreground text-left">
            <p className="font-medium text-foreground">To fix this, you can:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Open your BlockWard invitation email and accept it</li>
              <li>Check you're signed in with the account the invitation was sent to</li>
              <li>Sign out and back in if you've just accepted</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;