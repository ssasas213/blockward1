import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Users, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { setPostAuthRedirect } from '@/lib/authRedirectGuard';

/**
 * NotAStudentDialog — the "I'm not a student" entry point (signup, login and
 * marketing header). Three plainly-worded paths so an administrator or
 * teacher arriving cold never has to create a student account first:
 *   1. Set up a new organisation → SchoolSetup (intent preserved through auth)
 *   2. Join as a teacher → staff code / invite explanation
 *   3. Join as a student → back to the normal signup
 *
 * context: 'signup' | 'login' | 'marketing'
 */
export default function NotAStudentDialog({ open, onOpenChange, context = 'signup' }) {
  const close = () => onOpenChange(false);

  // Organisation setup needs a signed-in owner. Store the intent so the user
  // lands on /SchoolSetup the moment they finish signing in — on the auth
  // pages they simply continue the form they are already on.
  const handleCreateOrg = () => {
    close();
    setPostAuthRedirect('/SchoolSetup');
    if (context === 'marketing') {
      window.location.href = '/SchoolSetup';
    } else if (context === 'login') {
      toast.info("Sign in to continue — you'll go straight to organisation setup.");
    } else {
      toast.info("Finish creating your account — you'll go straight to organisation setup.");
    }
  };

  const handleTeacher = () => {
    close();
    if (context === 'signup') {
      // The staff-code field is already on the signup form below.
      toast.info('Enter your staff code in the "School or club code" field, then continue.');
    } else if (context === 'login') {
      // An existing account enters codes on the JoinSchool hub after signing in.
      setPostAuthRedirect('/JoinSchool');
      toast.info("Sign in to continue — you'll enter your staff code next.");
    } else {
      window.location.href = '/Signup';
    }
  };

  const options = [
    {
      icon: Building2,
      title: 'Set up a new organisation',
      description: "You'll be the administrator. Create your school, club or academy and invite your staff and students.",
      action: handleCreateOrg,
    },
    {
      icon: Users,
      title: 'Join as a teacher',
      description: 'Ask your administrator for a staff invite or join code. Teachers are approved by an administrator.',
      action: handleTeacher,
    },
    {
      icon: GraduationCap,
      title: 'Join as a student',
      description: 'Back to the normal signup — a school or club is optional and can be added later.',
      action: close,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Not a student?</DialogTitle>
          <DialogDescription>Choose how you want to use BlockWard.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options.map((option) => (
            <button
              key={option.title}
              type="button"
              onClick={option.action}
              className="w-full flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-hover transition-all text-left"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <option.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-foreground">{option.title}</span>
                <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{option.description}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}