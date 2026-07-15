import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, AlertCircle, Lock, Loader2, ArrowLeft, LogIn } from 'lucide-react';

export default function AdminApprovalPage() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // 'not_admin' | 'wrong_school' | 'not_found' | 'auth_required'

  useEffect(() => {
    checkAccess();
  }, [recordId]);

  const checkAccess = async () => {
    if (!recordId) { setError('not_found'); setLoading(false); return; }
    try {
      // 1. Authenticate
      const user = await base44.auth.me();
      if (!user) { setError('auth_required'); setLoading(false); return; }

      // 2. Get user profile
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const profile = profiles[0];

      // 3. Must be admin
      if (!profile || profile.user_type !== 'admin') {
        setError('not_admin');
        setLoading(false);
        return;
      }

      // 4. Fetch the record to verify school
      const res = await base44.functions.invoke('getRecordDetail', { recordId });
      const data = res.data;

      if (!data?.ok) {
        setError(data?.error || 'not_found');
        setLoading(false);
        return;
      }

      // 5. Admin must belong to the same school as the record
      if (data.record.school_id !== profile.school_id) {
        setError('wrong_school');
        setLoading(false);
        return;
      }

      // All security checks passed — redirect to RecordDetail with query param
      // RecordDetail reads id from ?id= search params and renders the admin approval UI
      navigate(`/RecordDetail?id=${recordId}`, { replace: true });
    } catch (e) {
      setError('not_found');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    const config = {
      auth_required: {
        icon: LogIn,
        color: 'bg-info/10',
        iconColor: 'text-info',
        title: 'Sign In Required',
        message: 'You must be signed in as an administrator to approve this achievement.',
        action: { label: 'Sign In', path: '/Login' }
      },
      not_admin: {
        icon: Lock,
        color: 'bg-destructive/10',
        iconColor: 'text-destructive',
        title: 'Access Denied',
        message: 'You do not have permission to approve this achievement. Only school administrators can access the approval workflow.',
        action: null
      },
      wrong_school: {
        icon: Shield,
        color: 'bg-warning/10',
        iconColor: 'text-warning',
        title: 'Wrong Organisation',
        message: 'This achievement belongs to a different school. You can only approve records from your own organisation.',
        action: null
      },
      not_found: {
        icon: AlertCircle,
        color: 'bg-muted',
        iconColor: 'text-muted-foreground',
        title: 'Record Not Found',
        message: 'This achievement record could not be found or may have been removed.',
        action: null
      },
      access_denied: {
        icon: Lock,
        color: 'bg-destructive/10',
        iconColor: 'text-destructive',
        title: 'Access Denied',
        message: 'You do not have permission to view this record.',
        action: null
      },
    };
    const cfg = config[error] || config.not_found;
    const Icon = cfg.icon;

    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="shadow-xl text-center">
          <CardContent className="py-12">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${cfg.color}`}>
              <Icon className={`h-8 w-8 ${cfg.iconColor}`} />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">{cfg.title}</h1>
            <p className="text-muted-foreground mb-6">{cfg.message}</p>
            <div className="flex gap-3 justify-center">
              {cfg.action && (
                <Button onClick={() => navigate(cfg.action.path)}>
                  <LogIn className="h-4 w-4 mr-2" /> {cfg.action.label}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Should never reach here — navigate() happens on success.
  // This is a fallback for edge cases.
  return null;
}