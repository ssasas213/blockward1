import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Shield, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CFG = {
  active: { label: 'Active', icon: CheckCircle2, cls: 'border-success/30 bg-success/10 text-success' },
  suspended: { label: 'Suspended', icon: AlertCircle, cls: 'border-destructive/30 bg-destructive/10 text-destructive' },
  inactive: { label: 'Inactive', icon: Clock, cls: 'border-muted-foreground/30 bg-muted/30 text-muted-foreground' },
  pending_approval: { label: 'Pending', icon: Clock, cls: 'border-warning/30 bg-warning/10 text-warning' },
};

const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };

export default function AccountSection({ user, profile }) {
  const [showTech, setShowTech] = useState(false);
  const statusCfg = STATUS_CFG[profile?.status] || STATUS_CFG.active;
  const StatusIcon = statusCfg.icon;

  const updatedDate = profile?.updated_date || profile?.created_date;

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Shield className="h-4 w-4 text-primary" /> Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Email */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Email address</p>
            </div>
          </div>
        </div>

        {/* Role + Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{ROLE_LABEL[profile?.user_type] || '—'}</p>
              <p className="text-xs text-muted-foreground">Role</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border">
            <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
              <StatusIcon className={cn('h-4 w-4', statusCfg.cls.includes('success') ? 'text-success' : statusCfg.cls.includes('destructive') ? 'text-destructive' : statusCfg.cls.includes('warning') ? 'text-warning' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{statusCfg.label}</p>
              <p className="text-xs text-muted-foreground">Account Status</p>
            </div>
          </div>
        </div>

        {/* Connected Google account */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Google Account</p>
              <p className="text-xs text-muted-foreground">Connected via Google Sign-In</p>
            </div>
          </div>
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-xs">Active</Badge>
        </div>

        {/* Last updated */}
        {updatedDate && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Last updated</span>
            <span className="text-xs font-medium text-foreground">{format(new Date(updatedDate), 'dd MMM yyyy, HH:mm')}</span>
          </div>
        )}

        {/* Technical details — collapsed */}
        <div>
          <button
            onClick={() => setShowTech(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showTech ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showTech ? 'Hide' : 'View'} technical details
          </button>
          {showTech && (
            <div className="grid grid-cols-2 gap-3 mt-2 p-3 rounded-lg bg-muted/20 border border-border">
              <TechItem label="Profile ID" value={profile?.id?.slice(-8).toUpperCase()} />
              <TechItem label="School ID" value={profile?.school_id ? profile.school_id.slice(-8).toUpperCase() : '—'} />
              {profile?.admin_level && <TechItem label="Admin Level" value={profile.admin_level} />}
              {profile?.student_id && <TechItem label="Student ID" value={profile.student_id} />}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TechItem({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-mono text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}