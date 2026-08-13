import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, GraduationCap, Users, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

const ROLES = [
  { key: 'student', icon: GraduationCap, title: 'Student', description: 'Earn and track your achievements' },
  { key: 'teacher', icon: Users, title: 'Teacher', description: 'Verify and issue achievements' },
  { key: 'admin', icon: Shield, title: 'School Administrator', description: 'Manage school and approve records' },
];

export default function Onboarding() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        if (currentUser) {
          const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
          if (profiles.length > 0 && profiles[0].status !== 'pending_approval') {
            window.location.href = '/Login';
            return;
          }
        }
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !selectedRole) {
      toast.error('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    try {
      await base44.entities.UserProfile.create({
        user_email: user.email,
        user_type: selectedRole,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        status: 'active',
        total_achievement_points: 0,
        total_behaviour_points: 0,
      });

      if (selectedRole === 'admin') {
        window.location.href = createPageUrl('SchoolSetup');
      } else {
        window.location.href = createPageUrl('JoinSchool');
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error(error.message || 'Failed to create account');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background accent-glow">
      <Card className="w-full max-w-lg border-border bg-card/60 backdrop-blur-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Welcome to BlockWard</CardTitle>
          <CardDescription>How will you use BlockWard?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              {ROLES.map((role) => {
                const isSelected = selectedRole === role.key;
                return (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => setSelectedRole(role.key)}
                    className={`flex items-center gap-4 w-full p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      <role.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">{role.title}</p>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedRole && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={!firstName.trim() || !lastName.trim() || submitting}
                    className="w-full"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}