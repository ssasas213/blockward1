import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { MessageSquare, Send, Search, Plus, Mail, MailOpen, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function Messages() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [newMessage, setNewMessage] = useState({
    recipient_email: '',
    subject: '',
    content: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        
        // Load all direct messages (sent or received)
        const allMessages = await base44.entities.Message.filter({ type: 'direct' }, '-created_date');
        const userMessages = allMessages.filter(m => 
          m.sender_email === user.email || m.recipient_email === user.email
        );
        setMessages(userMessages);

        // Load potential contacts based on user type
        if (profiles[0].user_type === 'teacher') {
          // Teachers can message students and parents
          const students = await base44.entities.UserProfile.filter({ user_type: 'student' });
          setContacts(students);
        } else if (profiles[0].user_type === 'student') {
          // Students can message teachers
          const teachers = await base44.entities.UserProfile.filter({ user_type: 'teacher' });
          setContacts(teachers);
        } else {
          // Admins can message everyone
          const allProfiles = await base44.entities.UserProfile.list();
          setContacts(allProfiles.filter(p => p.user_email !== user.email));
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.recipient_email || !newMessage.content) {
      toast.error('Please select a recipient and enter a message');
      return;
    }

    try {
      const recipient = contacts.find(c => c.user_email === newMessage.recipient_email);
      
      await base44.entities.Message.create({
        school_id: profile.school_id,
        type: 'direct',
        sender_email: profile.user_email,
        sender_name: `${profile.first_name} ${profile.last_name}`,
        sender_type: profile.user_type,
        recipient_email: newMessage.recipient_email,
        recipient_name: `${recipient.first_name} ${recipient.last_name}`,
        subject: newMessage.subject || '(No subject)',
        content: newMessage.content,
        read: false
      });

      setShowComposeDialog(false);
      setNewMessage({ recipient_email: '', subject: '', content: '' });
      loadData();
      toast.success('Message sent');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const handleReply = async (originalMessage, replyContent) => {
    try {
      await base44.entities.Message.create({
        school_id: profile.school_id,
        type: 'direct',
        sender_email: profile.user_email,
        sender_name: `${profile.first_name} ${profile.last_name}`,
        sender_type: profile.user_type,
        recipient_email: originalMessage.sender_email,
        recipient_name: originalMessage.sender_name,
        subject: `Re: ${originalMessage.subject}`,
        content: replyContent,
        read: false,
        parent_message_id: originalMessage.id
      });

      loadData();
      toast.success('Reply sent');
    } catch (error) {
      toast.error('Failed to send reply');
    }
  };

  const markAsRead = async (message) => {
    if (!message.read && message.recipient_email === profile.user_email) {
      try {
        await base44.entities.Message.update(message.id, {
          read: true,
          read_at: new Date().toISOString()
        });
        loadData();
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }
  };

  // Group messages into conversations
  const conversations = {};
  messages.forEach(msg => {
    const otherParty = msg.sender_email === profile?.user_email ? msg.recipient_email : msg.sender_email;
    if (!conversations[otherParty]) {
      conversations[otherParty] = [];
    }
    conversations[otherParty].push(msg);
  });

  // Sort conversations by most recent message
  const sortedConversations = Object.entries(conversations)
    .map(([email, msgs]) => ({
      email,
      messages: msgs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
      latestMessage: msgs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0],
      unreadCount: msgs.filter(m => !m.read && m.recipient_email === profile?.user_email).length
    }))
    .sort((a, b) => new Date(b.latestMessage.created_date) - new Date(a.latestMessage.created_date));

  const filteredConversations = sortedConversations.filter(conv =>
    conv.latestMessage.sender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.latestMessage.recipient_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Messages</h1>
          <p className="text-slate-500 mt-1">Direct messaging with teachers and students</p>
        </div>
        <Button 
          onClick={() => setShowComposeDialog(true)}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="border-0 shadow-lg lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Conversations</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                  const isSelected = selectedConversation?.email === conv.email;
                  
                  return (
                    <button
                      key={conv.email}
                      onClick={() => {
                        setSelectedConversation(conv);
                        conv.messages.forEach(msg => markAsRead(msg));
                      }}
                      className={`w-full p-4 text-left hover:bg-slate-50 transition-colors border-b ${
                        isSelected ? 'bg-violet-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {otherPartyName?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-slate-900 truncate">{otherPartyName}</p>
                              {conv.unreadCount > 0 && (
                                <Badge className="bg-violet-600 text-white">{conv.unreadCount}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 truncate">{conv.latestMessage.content}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {format(new Date(conv.latestMessage.created_date), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="border-0 shadow-lg lg:col-span-2">
          {selectedConversation ? (
            <MessageThread
              conversation={selectedConversation}
              profile={profile}
              onReply={handleReply}
            />
          ) : (
            <CardContent className="text-center py-20">
              <Mail className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Select a conversation</h3>
              <p className="text-slate-500">Choose a conversation from the list to view messages</p>
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
                value={newMessage.recipient_email}
                onValueChange={(value) => setNewMessage({ ...newMessage, recipient_email: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.user_email}>
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
            <Button variant="outline" onClick={() => setShowComposeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendMessage}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageThread({ conversation, profile, onReply }) {
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
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
            {otherPartyName?.[0]}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{otherPartyName}</h3>
            <p className="text-sm text-slate-500">{sortedMessages.length} messages</p>
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
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white' 
                      : 'bg-slate-100 text-slate-900'
                  }`}>
                    {msg.subject && msg.subject !== '(No subject)' && (
                      <p className={`text-sm font-semibold mb-1 ${isSender ? 'text-white' : 'text-slate-700'}`}>
                        {msg.subject}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div className={`flex items-center gap-2 mt-1 px-2 text-xs text-slate-400 ${
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
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Type your reply..."
            rows={2}
            className="flex-1"
          />
          <Button onClick={handleSendReply} disabled={!replyContent.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}