import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import {
  Building2, CheckCircle2, Clock, AlertCircle, BookOpen, Calendar,
  Mail, LogIn, Plus, Shield, ArrowRight, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import JoinSchoolModal from './JoinSchoolModal';

const STATUS_CFG = {
  active: { label: 'Active', icon: CheckCircle2, cls: 'border-success/30 bg-success/10 text-success' },
  pending: { label: 'Pending Approval', icon: Clock, cls: 'border-warning/30 bg-warning/10 text-warning' },
  rejected: { label: 'Rejected', icon: AlertCircle, cls: 'border-destructive/30 bg-destructive/10 text-destructive' },
};

export default function SchoolMembershipSection({ profile, user, school, onRefresh }) {
  const navigate = useNavigate();
  const [joinOpen, setJoinOpen] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [loadingMems, setLoadingMems] = useState(false);

  const roleType = profile?.user_type || 'teacher';

  useEffect(() => {
    if (!user?.email) return;
    loadMemberships();
  }, [user?.email]);

  const loadMemberships = async () => {
    setLoadingMems(true);
    try {
      const [staff, admin] = await Promise.all([
        base44.entities.StaffMembership.filter({ user_email: user.email }).catch(() => []),
        profile?.user_type === 'admin'
          ? base44.entities.AdminSchoolMembership.filter({ admin_email: user.email }).catch(() => [])
          : [],
      ]);
      setMemberships([...staff, ...admin]);
    } catch {}
    finally { setLoadingMems(false); }
  };

  const handleJoined = () => {
    setJoinOpen(false);
    if (onRefresh) onRefresh();
    loadMemberships();
  };

  // Has school linked
  const hasSchool = !!school && !!profile?.school_id;
  const pendingMembership = memberships.find(m => m.status === 'pending');

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Building2 className="h-4 w-4 text-primary" /> School Membership
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasSchool ? (
          <>
            <LinkedSchoolView profile={profile} school={school} memberships={memberships} />
            {roleType !== 'admin' && (
              <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setJoinOpen(true)}>
                <LogIn className="h-4 w-4 mr-2" /> Join Another School
              </Button>
            )}
          </>
        ) : pendingMembership ? (
          <PendingView membership={pendingMembership} schoolName={pendingMembership.school_name} />
        ) : (
          <NoSchoolView roleType={roleType} onJoin={() => setJoinOpen(true)} navigate={navigate} />
        )}
      </CardContent>

      <JoinSchoolModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={handleJoined}
        roleType={roleType}
      />
    </Card>
  );
}

function LinkedSchoolView({ profile, school, memberships }) {
  const navigate = useNavigate();
  const staffMembership = memberships.find(m => m.status === 'active');
  const status = staffMembership?.status || 'active';
  const statusCfg = STATUS_CFG[status] || STATUS_CFG.active;
  const StatusIcon = statusCfg.icon;

  const [teacherClasses, setTeacherClasses] = useState([]);
  useEffect(() => {
    if (profile?.user_type === 'teacher' && school?.id) {
      base44.entities.Class.filter({ teacher_email: profile.user_email, school_id: school.id })
        .then(setTeacherClasses).catch(() => {});
    }
  }, [profile, school]);

  return (
    <div className="space-y-4">
      {/* School identity */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-xl overflow-hidden border border-border bg-muted/30 flex items-center justify-center flex-shrink-0">
          {school?.logo_url ? (
            <img src={school.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{school?.name}</h3>
            <Badge variant="outline" className={cn('gap-1', statusCfg.cls)}>
              <StatusIcon className="h-3 w-3" /> {statusCfg.label}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span className="text-xs text-muted-foreground capitalize">{profile?.user_type}</span>
            {school?.city && <span className="text-xs text-muted-foreground">{school.city}</span>}
            {school?.country && <span className="text-xs text-muted-foreground">{school.country}</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl('SystemSettings'))}>
          View School <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      {/* Membership details */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border">
        <DetailItem icon={Shield} label="Role" value={profile?.user_type === 'admin' ? 'Administrator' : profile?.user_type === 'teacher' ? 'Teacher' : 'Student'} />
        {profile?.department && <DetailItem icon={BookOpen} label="Department" value={profile.department} />}
        {profile?.grade_level && <DetailItem icon={BookOpen} label="Grade Level" value={profile.grade_level} />}
        <DetailItem icon={Calendar} label="Joined" value={staffMembership?.joined_at ? format(new Date(staffMembership.joined_at), 'MMM yyyy') : profile?.created_date ? format(new Date(profile.created_date), 'MMM yyyy') : '—'} />
        {profile?.user_type === 'teacher' && (
          <DetailItem icon={BookOpen} label="Classes" value={teacherClasses.length > 0 ? teacherClasses.map(c => c.name).join(', ') : 'None assigned'} />
        )}
        {profile?.subjects?.length > 0 && (
          <DetailItem icon={BookOpen} label="Subjects" value={profile.subjects.join(', ')} />
        )}
      </div>

      {/* Admin contact */}
      {school?.admin_email && profile?.user_type !== 'admin' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border">
          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground">School Administrator:</span>
          <span className="text-xs font-medium text-foreground truncate">{school.admin_email}</span>
        </div>
      )}
    </div>
  );
}

function PendingView({ membership, schoolName }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/10">
      <Clock className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Pending Approval</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your request to join <span className="font-medium text-foreground">{schoolName || 'this school'}</span> is awaiting administrator approval.
        </p>
      </div>
    </div>
  );
}

function NoSchoolView({ roleType, onJoin, navigate }) {
  const canCreate = roleType === 'admin';
  return (
    <div className="text-center py-6">
      <div className="h-14 w-14 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
        <Building2 className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground mb-1">You are not currently linked to a school.</p>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
        Join an existing school with a code, request access, or {canCreate ? 'create a new school workspace.' : 'ask your administrator for a school code.'}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
        <Button onClick={onJoin} className="bg-gradient-to-r from-primary to-accent text-white">
          <LogIn className="h-4 w-4 mr-2" /> Join a School
        </Button>
        {canCreate && (
          <Button variant="outline" onClick={() => navigate(createPageUrl('SchoolSetup'))}>
            <Plus className="h-4 w-4 mr-2" /> Create a School
          </Button>
        )}
        {canCreate && (
          <Button variant="ghost" onClick={() => navigate(createPageUrl('SchoolSetup') + '?mode=join')}>
            Join Existing School
          </Button>
        )}
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-sm font-medium text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}