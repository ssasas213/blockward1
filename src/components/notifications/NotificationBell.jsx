import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, X, Check, CheckCheck, AlertCircle, Megaphone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const TYPE_ICONS = {
  announcement_urgent: AlertCircle,
  announcement_important: Megaphone,
  announcement_scheduled_reminder: Clock,
};

export default function NotificationBell({ userEmail }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!userEmail) return;
    loadNotifications();

    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.data?.user_email === userEmail) {
        loadNotifications();
      }
    });
    return () => unsub();
  }, [userEmail]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await base44.entities.Notification.filter({ user_email: userEmail }, '-created_date', 30);
      setNotifications(data || []);
    } catch (_) {}
  };

  const markRead = async (n) => {
    if (n.read) return;
    await base44.entities.Notification.update(n.id, { read: true, read_at: new Date().toISOString() });
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { read: true, read_at: new Date().toISOString() })));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-96 max-h-[480px] bg-popover rounded-2xl shadow-2xl border border-border z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-popover-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded-md">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n)}
                    className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      n.priority === 'urgent' ? 'bg-destructive/10' : n.priority === 'important' ? 'bg-warning/10' : 'bg-muted'
                    }`}>
                      <Icon className={`h-4 w-4 ${n.priority === 'urgent' ? 'text-destructive' : n.priority === 'important' ? 'text-warning' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-popover-foreground leading-snug ${!n.read ? 'font-semibold' : ''}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{format(new Date(n.created_date || new Date()), 'd MMM, h:mm a')}</p>
                    </div>
                    {!n.read && <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}