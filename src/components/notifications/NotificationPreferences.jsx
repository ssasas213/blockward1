import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Megaphone, Clock } from 'lucide-react';
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

export default function NotificationPreferences({ userEmail }) {
  const [prefs, setPrefs] = useState(null);
  const [prefId, setPrefId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    loadPrefs();
  }, [userEmail]);

  const loadPrefs = async () => {
    const data = await base44.entities.NotificationPreference.filter({ user_email: userEmail });
    if (data.length > 0) {
      setPrefs(data[0]);
      setPrefId(data[0].id);
    } else {
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

  if (!prefs) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading preferences...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900 mb-0.5">Notification Preferences</h3>
        <p className="text-xs text-slate-500">Choose which announcements trigger in-app alerts</p>
      </div>
      {PREFS.map(p => {
        const Icon = p.icon;
        return (
          <div key={p.key} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center">
                <Icon className={`h-4 w-4 ${p.iconColor}`} />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-800">{p.label}</Label>
                <p className="text-xs text-slate-500">{p.description}</p>
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
    </div>
  );
}