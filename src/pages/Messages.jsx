import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, Search, Plus, Mail, MailOpen, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useSchool } from '@/lib/SchoolContext';

export default function Messages() {
  const { testMode } = useSchool();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState({
    recipient_id: '',
    subject: '',
    content: ''
  });

  // Reload whenever the active persona changes (Test Mode switches)
  const personaKey = testMode?.isTestSuperUser ? testMode.activePersona : null;
  useEffect(() => {
    loadData();
  }, [personaKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getMessages', {});
      const data = res.data || {};
      if (!data.ok) {
        throw new Error(data.error || 'Could not load messages');
      }
      setProfile(data.profile || null);
      setMessages(data.messages || []);
      setContacts(data.contacts || []);
      setSelectedConversation(null);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Could not load your messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.recipient_id || !newMessage.content.trim()) {
      toast.error('Please select a recipient and enter a message');
      return;
    }
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendMessage', {
        recipient_profile_id: newMessage.recipient_id,
        subject: newMessage.subject,
        content: newMessage.content,
      });
      const data = res.data || {};
      if (!data.ok) {
        throw new Error(data.error || 'Failed to send message');
      }
      setShowComposeDialog(false);
      setNewMessage({ recipient_id: '', subject: '', content: '' });
      await loadData();
      toast.success('Message sent');
    } catch (error) {
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (originalMessage, replyContent) => {
    if (!replyContent || !replyContent.trim()) return;
    // The other party is whoever is NOT the effective persona.
    const otherPartyId = originalMessage.sender_email === profile.user_email
      ? originalMessage.recipient_profile_id
      : originalMessage.sender_profile_id;
    if (!otherPartyId) {
      toast.error('Could not resolve the recipient for this reply.');
      return;
    }
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendMessage', {
        recipient_profile_id: otherPartyId,
        subject: `Re: ${originalMessage.subject || '(No subject)'}`,
        content: replyContent,
      });
      const data = res.data || {};
      if (!data.ok) {
        throw new Error(data.error || 'Failed to send reply');
      }
      await loadData();
      toast.success('Reply sent');
    } catch (error) {
      toast.error(error.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (message) => {
    if (!message.read && message.recipient_email === profile?.user_email) {
      try {
        await base44.functions.invoke('markMessageRead', { message_id: message.id });
        // Optimistic local update; full reload happens on next loadData.
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, read: true, status: 'read' } : m));
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }
  };

  // Group messages into conversations by conversation_id (stable), fallback to other party email
  const conversations = {};
  messages.forEach(msg => {
    const key = msg.conversation_id || (msg.sender_email === profile?.user_email ? msg.recipient_email : msg.sender_email);
    if (!conversations[key]) conversations[key] = [];
    conversations[key].push(msg);
  });

  const sortedConversations = Object.entries(conversations)
    .map(([key, msgs]) => {
      const ordered = msgs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return {
        key,
        messages: ordered,
        latestMessage: ordered[0],
        unreadCount: msgs.filter(m => !m.read && m.recipient_email === profile?.user_email).length
      };
    })
    .sort((a, b) => new Date(b.latestMessage.created_date) - new Date(a.latestMessage.created_date));

  const filteredConversations = sortedConversations.filter(conv =>
    conv.latestMessage.sender_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.latestMessage.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-1">Direct messaging with teachers and students</p>
        </div>
        <Button onClick={() => setShowComposeDialog(true)} disabled={contacts.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search messages..."
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conv) => {
                  const otherPartyName = conv.latestMessage.sender_email === profile.user_email
                    ? conv.latestMessage.recipient_name
                    : conv.latestMessage.sender_name;
                  const isSelected = selectedConversation?.key === conv.key;

                  return (
                    <button
                      key={conv.key}
                      onClick={() => {
                        setSelectedConversation(conv);
                        conv.messages.forEach(msg => markAsRead(msg));
                      }}
                      className={`w-full p-4 text-left hover:bg-hover/50 transition-colors border-b border-border ${
                        isSelected ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold flex-shrink-0">
                            {otherPartyName?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-foreground truncate">{otherPartyName}</p>
                              {conv.unreadCount > 0 && (
                                <Badge>{conv.unreadCount}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{conv.latestMessage.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(conv.latestMessage.created_date), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{contacts.length === 0 ? 'No one to message yet' : 'No conversations yet'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2">
          {selectedConversation ? (
            <MessageThread
              conversation={selectedConversation}
              profile={profile}
              onReply={handleReply}
              sending={sending}
            />
          ) : (
            <CardContent className="text-center py-20">
              <Mail className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Select a conversation</h3>
              <p className="text-muted-foreground">Choose a conversation from the list to view messages</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Compose Dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>Send a direct message</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Select
                value={newMessage.recipient_id}
                onValueChange={(value) => setNewMessage({ ...newMessage, recipient_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name} ({contact.user_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject (optional)</Label>
              <Input
                value={newMessage.subject}
                onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                placeholder="Message subject"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={newMessage.content}
                onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                placeholder="Type your message..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComposeDialog(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSendMessage} disabled={sending}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageThread({ conversation, profile, onReply, sending }) {
  const [replyContent, setReplyContent] = useState('');
  const sortedMessages = [...conversation.messages].sort((a, b) =>
    new Date(a.created_date) - new Date(b.created_date)
  );

  const otherPartyName = conversation.latestMessage.sender_email === profile.user_email
    ? conversation.latestMessage.recipient_name
    : conversation.latestMessage.sender_name;

  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    onReply(conversation.latestMessage, replyContent);
    setReplyContent('');
  };

  return (
    <>
      <CardHeader className="border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold">
            {otherPartyName?.[0]}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{otherPartyName}</h3>
            <p className="text-sm text-muted-foreground">{sortedMessages.length} messages</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {sortedMessages.map((msg, index) => {
            const isSender = msg.sender_email === profile.user_email;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex gap-3 ${isSender ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isSender ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 ${
                    isSender
                      ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}>
                    {msg.subject && msg.subject !== '(No subject)' && (
                      <p className="text-sm font-semibold mb-1">
                        {msg.subject}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div className={`flex items-center gap-2 mt-1 px-2 text-xs text-muted-foreground ${
                    isSender ? 'justify-end' : 'justify-start'
                  }`}>
                    <Clock className="h-3 w-3" />
                    {format(new Date(msg.created_date), 'MMM d, h:mm a')}
                    {msg.read && isSender && <MailOpen className="h-3 w-3" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Type your reply..."
            rows={2}
            className="flex-1"
          />
          <Button onClick={handleSendReply} disabled={!replyContent.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}