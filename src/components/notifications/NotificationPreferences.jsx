import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, Clock, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const PREFS = [
  {
    key: 'notify_urgent',
    label: 'Urgent Announcements',
    description: 'Get alerted immediately when an urgent announcement is posted',
    icon: AlertTriangle,
    color: 'text-red-500',
    defaultOn: true,
  },
  {
    key: 'notify_important',
    label: 'Important Announcements',
    description: 'Get notified when an important announcement is posted',
    icon: Info,
    color: 'text-amber-500',
    defaultOn: true,
  },
  {
    key: 'notify_scheduled_reminder',
    label: 'Scheduled Announcement Reminders',
    description: 'Get a heads-up before a scheduled announcement goes out',
    icon: Clock,
    color: 'text-blue-500',
    defaultOn: false,
  },
];

export default function NotificationPreferences({ userEmail }) {
  const [prefs, setPrefs] = useState(null);
  const [prefId, setPrefId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    loadPrefs();
  }, [userEmail]);

  const loadPrefs = async () => {
    const existing = await base44.entities.NotificationPreference.filter({ user_email: userEmail });
    if (existing.length > 0) {
      setPrefs(existing[0]);
      setPrefId(existing[0].id);
    } else {
      setPrefs({ user_email: userEmail, notify_urgent: true, notify_important: true, notify_scheduled_reminder: false });
    }
  };

  const toggle = async (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    setSaved(false);
    if (prefId) {
      await base44.entities.NotificationPreference.update(prefId, { [key]: updated[key] });
    } else {
      const created = await base44.entities.NotificationPreference.create(updated);
      setPrefId(created.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!prefs) return <div className="animate-pulse h-40 bg-slate-100 rounded-xl" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-violet-600" />
          <CardTitle className="text-base">Notification Preferences</CardTitle>
        </div>
        <CardDescription>Choose which in-app alerts you want to receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PREFS.map(({ key, label, description, icon: Icon, color }) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
            </div>
            <Switch
              checked={!!prefs[key]}
              onCheckedChange={() => toggle(key)}
            />
          </div>
        ))}
        {(saving || saved) && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            {saved && <Check className="h-3 w-3 text-green-500" />}
            {saving ? 'Saving...' : 'Preferences saved'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}