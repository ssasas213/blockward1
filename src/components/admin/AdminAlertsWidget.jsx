import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, MailX, UserCheck, LinkIcon } from 'lucide-react';
import { format } from 'date-fns';

/**
 * AdminAlertsWidget — operational alerts for the organisation admin:
 * missing registers today, failed email invitations, pending staff
 * approvals and failed blockchain anchors. Computed server-side in
 * getDashboardData (scoped to the admin's own organisation).
 */
export default function AdminAlertsWidget() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    const now = new Date();
    const dayIndex = (now.getDay() + 6) % 7; // Monday-first, like TimetableEntry
    base44.functions.invoke('getDashboardData', { day_index: dayIndex, date: format(now, 'yyyy-MM-dd') })
      .then((res) => {
        const d = res.data || {};
        if (d.ok && d.role === 'admin') setAlerts(d.alerts || null);
      })
      .catch(() => { /* the widget stays hidden on failure */ })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !alerts) return null;

  const missing = alerts.missing_registers || [];
  const failedInvites = alerts.failed_invitations || [];
  const items = [];
  if (missing.length) items.push({ key: 'registers', icon: AlertTriangle, tone: 'text-warning', count: missing.length, title: 'Missing registers today', body: missing.map(m => `${m.class_name || 'Class'}${m.start_time ? ` (${m.start_time})` : ''}`).slice(0, 3).join(' · '), link: createPageUrl('AdminAttendance') });
  if (failedInvites.length) items.push({ key: 'invites', icon: MailX, tone: 'text-destructive', count: failedInvites.length, title: 'Failed email invitations', body: failedInvites.map(i => i.email).slice(0, 3).join(' · '), link: createPageUrl('Invitations') });
  if (alerts.pending_staff_approvals > 0) items.push({ key: 'staff', icon: UserCheck, tone: 'text-info', count: alerts.pending_staff_approvals, title: 'Pending staff approvals', body: `${alerts.pending_staff_approvals} staff join request${alerts.pending_staff_approvals === 1 ? '' : 's'} awaiting review`, link: createPageUrl('People') });
  if (alerts.failed_anchor_count > 0) items.push({ key: 'anchor', icon: LinkIcon, tone: 'text-destructive', count: alerts.failed_anchor_count, title: 'Failed blockchain anchors', body: `${alerts.failed_anchor_count} credential${alerts.failed_anchor_count === 1 ? '' : 's'} failed to anchor — retry from the credential register`, link: createPageUrl('ManageSchool') });

  if (items.length === 0) return null;

  return (
    <Card className="surface-card border-warning/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" /> Needs attention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map(a => (
          <Link key={a.key} to={a.link} className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border hover:border-primary/30 transition-colors">
            <a.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${a.tone}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <Badge variant="warning">{a.count}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.body}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}