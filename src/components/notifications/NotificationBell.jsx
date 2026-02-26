import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, AlertTriangle, Info, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow } from 'date-fns';

const typeConfig = {
  announcement_urgent: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
  announcement_important: { icon: Info, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-100' },
  announcement_scheduled_reminder: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100' },
};

export default function NotificationBell({ userEmail }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!userEmail) return;
    loadNotifications();
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' && event.data?.user_email === userEmail) {
        setNotifications(prev => [event.data, ...prev]);
      } else if (event.type === 'update') {
        setNotifications(prev => prev.map(n => n.id === event.id ? event.data : n));
      } else if (event.type === 'delete') {
        setNotifications(prev => prev.filter(n => n.id !== event.id));
      }
    });
    return () => unsub();
  }, [userEmail]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadNotifications = async () => {
    const data = await base44.entities.Notification.filter({ user_email: userEmail }, '-created_date', 30);
    setNotifications(data);
  };

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { read: true, read_at: new Date().toISOString() });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
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
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-violet-600 hover:underline font-medium">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">No notifications yet</div>
            ) : notifications.map(n => {
              const cfg = typeConfig[n.type] || typeConfig.announcement_important;
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  className={cn('flex gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors', !n.read && 'bg-violet-50/50')}
                  onClick={() => markRead(n.id)}
                >
                  <div className={cn('flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border', cfg.bg)}>
                    <Icon className={cn('h-4 w-4', cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium text-slate-900 leading-tight', !n.read && 'font-semibold')}>{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {n.created_date ? formatDistanceToNow(new Date(n.created_date), { addSuffix: true }) : ''}
                    </p>
                  </div>
                  {!n.read && <div className="flex-shrink-0 h-2 w-2 rounded-full bg-violet-500 mt-2" />}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
            <Link
              to={createPageUrl('Announcements')}
              onClick={() => setOpen(false)}
              className="text-xs text-violet-600 hover:underline font-medium"
            >
              View all announcements →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}