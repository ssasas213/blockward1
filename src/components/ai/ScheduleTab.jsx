import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Search, AlertCircle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

export default function ScheduleTab({ userType }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadUserContext();
  }, []);

  const loadUserContext = async () => {
    try {
      const u = await base44.auth.me();
      if (!u) return;
      const profiles = await base44.entities.UserProfile.filter({ user_email: u.email });
      const profile = profiles[0] || null;
      setUserData({ user: u, profile });
    } catch (_) {}
  };

  const quickQuestions = userType === 'student'
    ? [
        'What classes do I have today?',
        'Is there assembly this week?',
        'What events are coming up?',
        "What's happening tomorrow?",
      ]
    : [
        'What classes do I teach today?',
        'Is there assembly today?',
        'Any staff events this week?',
        "What's happening tomorrow?",
      ];

  const ask = async (q) => {
    const finalQ = q || question;
    if (!finalQ.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke('blockwardAI', {
        tool: 'ASK_SCHEDULE',
        message: finalQ,
        scope: { type: 'SCHOOL' },
      });
      const data = res.data;
      if (data.ok || data.events !== undefined) {
        setResult(data);
      } else if (data.code === 'OPENAI_ERROR' && data.message?.includes('429')) {
        setError('AI is busy right now. Please wait a moment and try again.');
      } else {
        setError(data.message || 'Something went wrong.');
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = userData?.profile?.first_name || userData?.user?.full_name?.split(' ')[0] || '';

  return (
    <div className="space-y-5">
      {firstName && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-xl">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {firstName[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{greeting()}, {firstName}! 👋</p>
            <p className="text-xs text-slate-500">
              {userType === 'student'
                ? "Ask me anything about your schedule, events or assemblies."
                : "Ask me about school events, your classes or upcoming assemblies."}
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Quick questions</p>
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map(q => (
            <button
              key={q}
              onClick={() => { setQuestion(q); ask(q); }}
              className="text-xs px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Textarea
          placeholder={
            userType === 'student'
              ? "Ask about your timetable, assemblies, events… e.g. 'What's on Thursday?'"
              : "Ask about school events, assemblies… e.g. 'Any events for my classes this week?'"
          }
          value={question}
          onChange={e => setQuestion(e.target.value)}
          className="resize-none min-h-[80px]"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
        />
        <Button
          onClick={() => ask()}
          disabled={loading || !question.trim()}
          className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
        >
          <Search className="h-4 w-4" />
          {loading ? 'Searching...' : 'Ask BlockWard AI'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-violet-600 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-medium text-violet-900">BlockWard AI</span>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-line">{result.answer}</p>
          </div>

          {result.events?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Events found ({result.events.length})
              </p>
              {result.events.map((ev, i) => (
                <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-slate-900">{ev.title}</h4>
                    {ev.audience && (
                      <Badge variant="outline" className="text-xs shrink-0 capitalize">
                        {ev.audience === 'whole_school' ? 'Whole School' : ev.audience.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {ev.start_time && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(ev.start_time), 'EEE d MMM yyyy, HH:mm')}
                        {ev.end_time && ` – ${format(new Date(ev.end_time), 'HH:mm')}`}
                      </div>
                    )}
                    {ev.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {ev.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}