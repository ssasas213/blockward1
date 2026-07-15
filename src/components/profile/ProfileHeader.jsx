import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, School, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };

const STATUS_CONFIG = {
  active: { label: 'Active', icon: CheckCircle2, cls: 'border-success/30 bg-success/10 text-success' },
  suspended: { label: 'Suspended', icon: AlertCircle, cls: 'border-destructive/30 bg-destructive/10 text-destructive' },
  inactive: { label: 'Inactive', icon: Clock, cls: 'border-muted-foreground/30 bg-muted/30 text-muted-foreground' },
  pending_approval: { label: 'Pending', icon: Clock, cls: 'border-warning/30 bg-warning/10 text-warning' },
};

export default function ProfileHeader({ profile, user, school }) {
  const [showDetails, setShowDetails] = useState(false);
  const statusCfg = STATUS_CONFIG[profile?.status] || STATUS_CONFIG.active;
  const StatusIcon = statusCfg.icon;

  const displayName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown User';
  const initials = (profile?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase();
  const hasAvatar = !!profile?.avatar_url;

  const techId = profile?.user_type === 'student'
    ? profile?.student_id
    : profile?.user_type === 'teacher'
      ? null
      : profile?.admin_level;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-card shadow-lg">
      {/* Banner — dark purple-to-black gradient with pink ambient glow */}
      <div className="relative h-24 sm:h-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-card to-black" />
        <div className="absolute inset-0 accent-glow" />
        {/* Faint decorative lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 12px, rgba(255,255,255,0.5) 12px, rgba(255,255,255,0.5) 13px)',
          }}
        />
      </div>

      {/* Main content */}
      <div className="px-5 sm:px-6 pb-5 sm:pb-6">
        {/* Identity row */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 -mt-12 sm:-mt-14">
          {/* Avatar */}
          {hasAvatar ? (
            <img
              src={profile.avatar_url}
              alt="avatar"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover shadow-xl border-2 border-border flex-shrink-0"
            />
          ) : (
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shadow-xl border-2 border-border flex-shrink-0 bg-gradient-to-br from-primary to-accent">
              {initials}
            </div>
          )}

          {/* Name, email, badges */}
          <div className="flex-1 min-w-0 pt-1 sm:pt-2">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate">{displayName}</h2>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{user?.email}</p>
            <div className="flex flex-wrap gap-2 mt-2.5">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary gap-1">
                <Shield className="h-3 w-3" />
                {ROLE_LABEL[profile?.user_type] || profile?.user_type || 'User'}
              </Badge>
              <Badge variant="outline" className={cn('gap-1', statusCfg.cls)}>
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </Badge>
              {school && (
                <Badge variant="outline" className="border-border bg-muted/40 text-foreground gap-1">
                  <School className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate max-w-[140px]">{school.name}</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Metadata row — only meaningful fields */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-border">
          <MetaItem label="Joined" value={profile?.created_date ? format(new Date(profile.created_date), 'MMM yyyy') : '—'} />
          {profile?.department && <MetaItem label="Department" value={profile.department} />}
          {profile?.grade_level && <MetaItem label="Grade Level" value={profile.grade_level} />}
          <MetaItem label="Account Status" value={statusCfg.label} />
        </div>

        {/* Technical details — collapsible */}
        {(profile?.school_id || techId) && (
          <div className="mt-3">
            <button
              onClick={() => setShowDetails(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showDetails ? 'Hide' : 'View'} technical details
            </button>
            {showDetails && (
              <div className="grid grid-cols-2 gap-3 mt-2 p-3 rounded-lg bg-muted/20 border border-border">
                {profile?.school_id && <MetaItem label="School ID" value={profile.school_id.slice(-8).toUpperCase()} mono />}
                {techId && <MetaItem label={profile?.user_type === 'student' ? 'Student ID' : 'Admin Level'} value={techId} mono />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-sm font-medium text-foreground mt-0.5 truncate', mono && 'font-mono')}>{value}</p>
    </div>
  );
}