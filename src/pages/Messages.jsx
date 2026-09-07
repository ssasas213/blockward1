import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import DirectMessages from '@/components/messages/DirectMessages';
import Announcements from '@/pages/Announcements';
import ParentComms from '@/pages/ParentComms';
import { useSchool } from '@/lib/SchoolContext';

/**
 * Inbox — Direct messages for everyone, plus a tabbed inbox:
 * teachers: Messages / Announcements / Parent Comms;
 * students: Messages / Announcements — each with one combined unread badge.
 */
export default function Messages() {
  const { profile } = useSchool();
  const [dmUnread, setDmUnread] = useState(0);
  const [announceUnread, setAnnounceUnread] = useState(0);
  const userType = profile?.user_type;

  // Students: count unread announcements (sent + applicable, minus read receipts)
  useEffect(() => {
    if (userType !== 'student') return;
    let cancelled = false;
    (async () => {
      try {
        const u = await base44.auth.me();
        const data = await base44.entities.Announcement.filter({ status: 'sent' }, '-created_date', 50);
        const applicable = (data || []).filter(a => {
          if (a.scope_type === 'SCHOOL' || !a.scope_type) return true;
          if (a.scope_type === 'STUDENTS') return (a.student_emails || []).includes(u.email);
          return true;
        });
        const receipts = await base44.entities.AnnouncementReadReceipt.filter({ user_id: u.email });
        const readIds = new Set((receipts || []).map(r => r.announcement_id));
        if (!cancelled) setAnnounceUnread(applicable.filter(a => !readIds.has(a.id)).length);
      } catch {
        /* badge falls back to messages-only */
      }
    })();
    return () => { cancelled = true; };
  }, [userType]);

  if (userType === 'teacher') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
            <p className="text-muted-foreground mt-1">Messages, announcements and parent communications</p>
          </div>
          {dmUnread > 0 && (
            <Badge className="text-sm px-3 py-1">{dmUnread} unread</Badge>
          )}
        </div>

        <Tabs defaultValue="messages">
          <TabsList>
            <TabsTrigger value="messages">
              Messages {dmUnread > 0 && `(${dmUnread})`}
            </TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="parents">Parent Comms</TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-6">
            <DirectMessages onUnreadCount={setDmUnread} />
          </TabsContent>
          <TabsContent value="announcements" className="mt-6">
            <Announcements />
          </TabsContent>
          <TabsContent value="parents" className="mt-6">
            <ParentComms />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (userType === 'student') {
    const combined = dmUnread + announceUnread;
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
            <p className="text-muted-foreground mt-1">Messages and announcements</p>
          </div>
          {combined > 0 && (
            <Badge className="text-sm px-3 py-1">{combined} unread</Badge>
          )}
        </div>

        <Tabs defaultValue="messages">
          <TabsList>
            <TabsTrigger value="messages">
              Messages {dmUnread > 0 && `(${dmUnread})`}
            </TabsTrigger>
            <TabsTrigger value="announcements">
              Announcements {announceUnread > 0 && `(${announceUnread})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-6">
            <DirectMessages onUnreadCount={setDmUnread} />
          </TabsContent>
          <TabsContent value="announcements" className="mt-6">
            <Announcements />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return <DirectMessages />;
}