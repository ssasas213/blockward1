import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import DirectMessages from '@/components/messages/DirectMessages';
import Announcements from '@/pages/Announcements';
import ParentComms from '@/pages/ParentComms';
import { useSchool } from '@/lib/SchoolContext';

/**
 * Inbox — Messages for everyone, and for teachers a tabbed inbox:
 * Messages / Announcements / Parent Comms, with one combined unread badge.
 */
export default function Messages() {
  const { profile } = useSchool();
  const [unread, setUnread] = useState(0);
  const isTeacher = profile?.user_type === 'teacher';

  if (!isTeacher) {
    return <DirectMessages />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
          <p className="text-muted-foreground mt-1">Messages, announcements and parent communications</p>
        </div>
        {unread > 0 && (
          <Badge className="text-sm px-3 py-1">{unread} unread</Badge>
        )}
      </div>

      <Tabs defaultValue="messages">
        <TabsList>
          <TabsTrigger value="messages">
            Messages {unread > 0 && `(${unread})`}
          </TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="parents">Parent Comms</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-6">
          <DirectMessages onUnreadCount={setUnread} />
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