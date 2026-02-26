import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Send } from 'lucide-react';

const EXAMPLES = [
  "What assemblies are happening this week?",
  "Any events tomorrow?",
  "What's on next week?",
  "Are there any sports events coming up?",
  "When is the next school event?",
];

export default function ScheduleTab({ userType }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState(null);

  const handleAsk = async (q) => {
    const text = (q || query).trim();
    if (!text) return;
    setLoading(true);
    setAnswer(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('blockwardAI', {
        tool: 'ASK_SCHEDULE',
        query: text,
      });
      const data = res.data;
      if (data?.answer) {
        setAnswer(data.answer);
      } else if (data?.error) {
        setError(data.error);
      } else {
        setError('No response received.');
      }
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-violet-600" />
          Ask about your school schedule
        </h2>
        <p className="text-xs text-slate-500 mt-1">Ask anything about upcoming events, assemblies, or school calendar.</p>
      </div>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map(ex => (
          <button
            key={ex}
            onClick={() => { setQuery(ex); handleAsk(ex); }}
            className="text-xs px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAsk()}
          placeholder="e.g. What events are happening this week?"
          className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
        />
        <Button
          onClick={() => handleAsk()}
          disabled={loading || !query.trim()}
          className="bg-violet-600 hover:bg-violet-700 gap-1.5 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </Button>
      </div>

      {/* Answer */}
      {answer && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-wrap">
          {answer}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}