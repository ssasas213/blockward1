import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, UserCheck, Clock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PendingTeacherRequests() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [processing, setProcessing] = useState({});

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const profile = profiles[0];
      if (!profile?.school_id) { setLoading(false); return; }

      const memberships = await base44.entities.StaffMembership.filter({
        school_id: profile.school_id,
      });
      // Show pending and recently reviewed
      const sorted = memberships.sort((a, b) => {
        // Pending first, then by date
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.requested_at || b.joined_at || 0) - new Date(a.requested_at || a.joined_at || 0);
      });
      setRequests(sorted.slice(0, 10));
    } catch (error) {
      console.error('Error loading teacher requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (membershipId) => {
    setProcessing({ ...processing, [membershipId]: 'approving' });
    try {
      const response = await base44.functions.invoke('approveJoinRequest', {
        membership_id: membershipId,
        membership_type: 'teacher',
        action: 'approve',
      });
      toast.success(`${response.data.teacher_name || 'Teacher'} approved`);
      await loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve');
    } finally {
      setProcessing({ ...processing, [membershipId]: null });
    }
  };

  const handleReject = async (membershipId) => {
    setProcessing({ ...processing, [membershipId]: 'rejecting' });
    try {
      const response = await base44.functions.invoke('approveJoinRequest', {
        membership_id: membershipId,
        membership_type: 'teacher',
        action: 'reject',
        rejection_reason: 'Not approved by administrator',
      });
      toast.success(`Request rejected`);
      await loadRequests();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject');
    } finally {
      setProcessing({ ...processing, [membershipId]: null });
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-card/60">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Pending Teacher Requests</h3>
          {pendingCount > 0 && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{pendingCount} pending</span>
          )}
        </div>

        <div className="space-y-2">
          {requests.map((req) => (
            <div key={req.id} className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-colors",
              req.status === 'pending' ? 'border-warning/20 bg-warning/5' : 'border-border bg-muted/20'
            )}>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm flex-shrink-0">
                {req.teacher_name?.[0]?.toUpperCase() || <Mail className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{req.teacher_name || req.user_email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {req.status === 'pending' && (
                    <span className="text-xs text-warning flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Pending approval
                    </span>
                  )}
                  {req.status === 'active' && (
                    <span className="text-xs text-success flex items-center gap-1">
                      <Check className="h-3 w-3" /> Approved
                    </span>
                  )}
                  {req.status === 'rejected' && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <X className="h-3 w-3" /> Rejected
                    </span>
                  )}
                  {req.requested_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.requested_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              {req.status === 'pending' && (
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button size="sm" onClick={() => handleApprove(req.id)} disabled={processing[req.id]} className="h-8 px-3">
                    {processing[req.id] === 'approving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(req.id)} disabled={processing[req.id]} className="h-8 px-3 text-destructive hover:text-destructive">
                    {processing[req.id] === 'rejecting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}