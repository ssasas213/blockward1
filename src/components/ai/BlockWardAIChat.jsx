import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2, AlertCircle, Plus, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const PROMPTS = {
  student: ["What are my latest grades?", "What's happening this week?", "What's my timetable tomorrow?", "How many BlockWards do I have?", "What achievements are pending?"],
  teacher: ["Who are my top students?", "Summarise my class.", "Show pending reviews.", "Analyse class grades.", "Which students may deserve recognition?"],
  admin: ["Give me a school summary.", "Show approval bottlenecks.", "How are grades performing?", "Show teacher activity.", "Show achievement trends."],
};

const ROLE_ACTIONS = {
  student: [
    { label: 'My Timetable', page: 'Timetable' },
    { label: 'My BlockWards', page: 'StudentBlockWards' },
    { label: 'My Points', page: 'MyPoints' },
    { label: 'Announcements', page: 'Announcements' },
  ],
  teacher: [
    { label: 'My Submissions', page: 'TeacherRecords' },
    { label: 'Create Achievement', page: 'IssueBlockWard' },
    { label: 'My Classes', page: 'Classes' },
    { label: 'Issue Points', page: 'IssuePoints' },
  ],
  admin: [
    { label: 'Approval Queue', page: 'AdminApprovalQueue' },
    { label: 'Records', page: 'AdminRecords' },
    { label: 'Analytics', page: 'Analytics' },
    { label: 'Users', page: 'ManageUsers' },
  ],
};

export default function BlockWardAIChat({ role }) {
  const effectiveRole = role || 'student';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef(null);

  // Load chat history from localStorage (per role)
  const storageKey = `bwai_chat_${effectiveRole}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed.chats || []);
      } else {
        setHistory([]);
      }
    } catch { setHistory([]); }
    setMessages([]);
  }, [storageKey]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const persistChat = (msgs) => {
    if (msgs.length === 0) return;
    try {
      const stored = localStorage.getItem(storageKey);
      const chats = stored ? JSON.parse(stored).chats || [] : [];
      const firstQ = msgs.find(m => m.role === 'user')?.text || 'New chat';
      const existing = chats.findIndex(c => c.preview === firstQ);
      const chat = { id: Date.now().toString(), preview: firstQ, messages: msgs, created_at: new Date().toISOString() };
      const updated = existing >= 0 ? chats.map((c, i) => i === existing ? chat : c) : [chat, ...chats].slice(0, 20);
      localStorage.setItem(storageKey, JSON.stringify({ chats: updated }));
      setHistory(updated);
    } catch {}
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    const userMsg = { role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await base44.functions.invoke('blockwardAIChat', { message: q });
      const data = res.data;
      if (!data?.ok) {
        setError(data?.message || 'Failed to get a response.');
        setMessages(prev => prev.slice(0, -1));
        return;
      }
      const aiMsg = { role: 'ai', text: data.answer, sources: data.data_sources, testMode: data.is_test_mode };
      setMessages(prev => {
        const updated = [...prev, aiMsg];
        persistChat(updated);
        return updated;
      });
    } catch (e) {
      setError(e?.message || 'Failed to get a response.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setError(null);
    setShowHistory(false);
  };

  const loadChat = (chat) => {
    setMessages(chat.messages || []);
    setShowHistory(false);
  };

  const actions = ROLE_ACTIONS[effectiveRole] || [];

  return (
    <div className="flex flex-col h-[560px]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">BlockWard AI</p>
            <p className="text-xs text-muted-foreground capitalize">{effectiveRole} assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowHistory(s => !s)} className="p-2 rounded-lg hover:bg-hover text-muted-foreground" title="Previous chats">
            <History className="h-4 w-4" />
          </button>
          <button onClick={newChat} className="p-2 rounded-lg hover:bg-hover text-muted-foreground" title="New chat">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="mb-3 p-2 rounded-xl border border-border bg-secondary/40 max-h-40 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">No previous chats.</p>
          ) : (
            <div className="space-y-1">
              {history.map(h => (
                <button key={h.id} onClick={() => loadChat(h)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-hover text-sm text-foreground truncate">
                  {h.preview}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-3 shadow-glow">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">What would you like to know?</p>
            <p className="text-xs text-muted-foreground mb-4">Ask about your school data — answers are grounded in real records.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'user' ? (
              <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-sm">
                {m.text}
              </div>
            ) : (
              <div className="max-w-[88%]">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-secondary/60 border border-border text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {m.text}
                </div>
                {m.sources && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                    Based on: {m.sources.join(', ')}
                  </p>
                )}
                {m.testMode && (
                  <p className="text-[11px] text-warning mt-1 px-1">Test Mode persona</p>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-secondary/60 border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Quick action prompts (shown when no messages yet) */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {PROMPTS[effectiveRole]?.map(p => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Navigation action buttons */}
      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border">
        {actions.map(a => (
          <Link key={a.page} to={createPageUrl(a.page)}>
            <span className="text-xs px-2.5 py-1 rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer">
              {a.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask BlockWard AI…"
          className="flex-1 h-10 px-4 rounded-lg bg-secondary/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-colors"
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()} className="gap-1.5 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}