import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Megaphone, Clock, Quote, UserPlus, BadgeCheck, PenLine, Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const PREFS = [
  {
    key: 'notify_urgent',
    label: 'Urgent announcements',
    description: 'Get notified immediately for urgent school alerts',
    icon: AlertCircle,
    iconColor: 'text-red-500',
    defaultOn: true,
  },
  {
    key: 'notify_important',
    label: 'Important announcements',
    description: 'Get notified for important school news and updates',
    icon: Megaphone,
    iconColor: 'text-amber-500',
    defaultOn: true,
  },
  {
    key: 'notify_scheduled_reminder',
    label: 'Scheduled announcement reminders',
    description: 'Get a heads-up before scheduled announcements are sent',
    icon: Clock,
    iconColor: 'text-blue-500',
    defaultOn: false,
  },
];

const SOCIAL_EVENTS = [
  {
    type: 'endorsement',
    label: 'Someone endorsed you',
    description: 'A peer spent one of their scarce endorsements on you',
    icon: Quote,
    iconColor: 'text-violet-500',
  },
  {
    type: 'follow',
    label: 'Someone followed you',
    description: 'New followers will see your verified achievements in their feed',
    icon: UserPlus,
    iconColor: 'text-blue-500',
  },
  {
    type: 'request_signed_off',
    label: 'Your request was signed off',
    description: 'A credential you requested was verified and published',
    icon: BadgeCheck,
    iconColor: 'text-emerald-500',
  },
  {
    type: 'request_changes',
    label: 'Your request needs changes',
    description: 'A reviewer sent your achievement request back with feedback',
    icon: PenLine,
    iconColor: 'text-amber-500',
  },
  {
    type: 'team_accepted',
    label: 'A teammate accepted a group credential',
    description: 'Someone you added to a team achievement joined the shared record',
    icon: Users,
    iconColor: 'text-cyan-500',
  },
  {
    type: 'opportunity_match',
    label: 'A matching opportunity was posted',
    description: 'An organisation posted an opportunity your credentials match',
    icon: Briefcase,
    iconColor: 'text-orange-500',
  },
];

export default function NotificationPreferences({ userEmail }) {
  const [prefs, setPrefs] = useState(null);
  const [prefId, setPrefId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    loadPrefs();
  }, [userEmail]);

  const loadPrefs = async () => {
    try {
      const data = await base44.entities.NotificationPreference.filter({ user_email: userEmail });
      if (data.length > 0) {
        setPrefs(data[0]);
        setPrefId(data[0].id);
      } else {
        setPrefs({ notify_urgent: true, notify_important: true, notify_scheduled_reminder: false });
        setPrefId(null);
      }
    } catch (_) {
      // Use defaults if entity/query fails
      setPrefs({ notify_urgent: true, notify_important: true, notify_scheduled_reminder: false });
      setPrefId(null);
    }
  };

  const toggle = async (key) => {
    const newVal = !prefs[key];
    const updated = { ...prefs, [key]: newVal };
    setPrefs(updated);
    setSaving(true);
    try {
      if (prefId) {
        await base44.entities.NotificationPreference.update(prefId, { [key]: newVal });
      } else {
        const created = await base44.entities.NotificationPreference.create({ user_email: userEmail, ...updated });
        setPrefId(created.id);
      }
      toast.success('Preferences saved');
    } catch (_) {
      toast.error('Failed to save preferences');
      setPrefs(prev => ({ ...prev, [key]: !newVal }));
    } finally {
      setSaving(false);
    }
  };

  // Per-event-type toggles (in-app / email), stored in the prefs object.
  const toggleEvent = async (type, channel) => {
    const current = (prefs.prefs || {})[type] || {};
    const newVal = current[channel] === undefined ? false : !current[channel];
    const nextPrefs = { ...(prefs.prefs || {}), [type]: { ...current, [channel]: newVal } };
    setSaving(true);
    try {
      if (prefId) {
        await base44.entities.NotificationPreference.update(prefId, { prefs: nextPrefs });
      } else {
        const created = await base44.entities.NotificationPreference.create({ user_email: userEmail, prefs: nextPrefs });
        setPrefId(created.id);
      }
      setPrefs((prev) => ({ ...prev, prefs: nextPrefs }));
      toast.success('Preferences saved');
    } catch (_) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) return <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading preferences...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground mb-0.5">Notification Preferences</h3>
        <p className="text-xs text-muted-foreground">Choose which announcements trigger in-app alerts</p>
      </div>
      {PREFS.map(p => {
        const Icon = p.icon;
        return (
          <div key={p.key} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center">
                <Icon className={`h-4 w-4 ${p.iconColor}`} />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground">{p.label}</Label>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>
            </div>
            <Switch
              checked={prefs[p.key] ?? p.defaultOn}
              onCheckedChange={() => toggle(p.key)}
              disabled={saving}
            />
          </div>
        );
      })}

      <div className="pt-3">
        <h3 className="font-semibold text-foreground mb-0.5">Social &amp; credential updates</h3>
        <p className="text-xs text-muted-foreground">Choose how you're told about endorsements, follows and request progress</p>
      </div>
      {SOCIAL_EVENTS.map(ev => {
        const Icon = ev.icon;
        const eventPrefs = (prefs.prefs || {})[ev.type] || {};
        return (
          <div key={ev.type} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center">
                <Icon className={`h-4 w-4 ${ev.iconColor}`} />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground">{ev.label}</Label>
                <p className="text-xs text-muted-foreground">{ev.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center">
                <Switch checked={eventPrefs.in_app !== false} onCheckedChange={() => toggleEvent(ev.type, 'in_app')} disabled={saving} />
                <p className="text-[10px] text-muted-foreground mt-1">In-app</p>
              </div>
              <div className="text-center">
                <Switch checked={eventPrefs.email !== false} onCheckedChange={() => toggleEvent(ev.type, 'email')} disabled={saving} />
                <p className="text-[10px] text-muted-foreground mt-1">Email</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}