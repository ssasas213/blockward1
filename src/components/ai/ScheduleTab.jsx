import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Calendar, Send } from 'lucide-react';

const EXAMPLE_QUERIES = [
  "What assemblies do we have this week?",
  "Are there any events tomorrow?",
  "What's happening next week?",
  "Show me all upcoming school events",
];

export default function ScheduleTab({ userType }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const handleAsk = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setAnswer('');
    try {
      const res = await base44.functions.invoke('blockwardAI', {
        tool: 'ASK_SCHEDULE',
        query: q.trim(),
      });
      const data = res.data;
      if (data.error) {
        setError(data.error);
      } else {
        setAnswer(data.answer || 'No answer returned.');
      }
    } catch (e) {
      setError(e.message || 'Failed to get answer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-violet-600" />
          Ask about the school schedule
        </h2>
        <p className="text-sm text-slate-500">Ask about upcoming events, assemblies, or activities.</p>
      </div>

      {/* Example prompts */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => { setQuery(q); handleAsk(q); }}
            className="text-xs px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. What assemblies are happening this week?"
          className="resize-none min-h-[60px]"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
        />
        <Button
          onClick={() => handleAsk()}
          disabled={loading || !query.trim()}
          className="bg-violet-600 hover:bg-violet-700 px-3 self-end"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* Answer */}
      {answer && (
        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-wrap border border-slate-200">
          {answer}
        </div>
      )}

      {error && (
        <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}
    </div>
  );
}