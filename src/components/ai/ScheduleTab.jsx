import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, Search, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const audienceOptions = [
  { value: 'any', label: 'Any audience' },
  { value: 'whole_school', label: 'Whole School' },
  { value: 'year_7', label: 'Year 7' },
  { value: 'year_8', label: 'Year 8' },
  { value: 'year_9', label: 'Year 9' },
  { value: 'year_10', label: 'Year 10' },
  { value: 'year_11', label: 'Year 11' },
  { value: 'staff_only', label: 'Staff Only' },
];

const quickQuestions = [
  'Is there assembly today?',
  'Any events this week?',
  'What\'s happening tomorrow?',
  'Any events next week?',
];

export default function ScheduleTab() {
  const [question, setQuestion] = useState('');
  const [audience, setAudience] = useState('any');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const ask = async (q) => {
    const finalQ = q || question;
    if (!finalQ.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke('aiScheduleAssistant', {
        question: finalQ,
        audience: audience === 'any' ? undefined : audience,
        dateHint: ''
      });
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Quick prompts */}
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

      {/* Input area */}
      <div className="space-y-3">
        <Textarea
          placeholder="Ask anything about school events, e.g. 'Is there assembly on Thursday?' or 'Any events for Year 9 this week?'"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          className="resize-none min-h-[80px]"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
        />
        <div className="flex gap-3">
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter audience" />
            </SelectTrigger>
            <SelectContent>
              {audienceOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => ask()} disabled={loading || !question.trim()} className="bg-violet-600 hover:bg-violet-700 gap-2">
            <Search className="h-4 w-4" />
            {loading ? 'Searching...' : 'Ask'}
          </Button>
        </div>
      </div>

      {/* Result */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* AI Answer */}
          <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-violet-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <span className="text-sm font-medium text-violet-900">BlockWard AI</span>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-line">{result.answer}</p>
          </div>

          {/* Event cards */}
          {result.events?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Events found ({result.events.length})</p>
              {result.events.map(ev => (
                <div key={ev.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-slate-900">{ev.title}</h4>
                    {ev.audience && ev.audience !== 'whole_school' && (
                      <Badge variant="outline" className="text-xs shrink-0 capitalize">{ev.audience.replace('_', ' ')}</Badge>
                    )}
                    {ev.audience === 'whole_school' && (
                      <Badge variant="outline" className="text-xs shrink-0 bg-blue-50 text-blue-700 border-blue-200">Whole School</Badge>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(ev.startTime), 'EEE d MMM yyyy, HH:mm')}
                      {ev.endTime && ` – ${format(new Date(ev.endTime), 'HH:mm')}`}
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {ev.location}
                      </div>
                    )}
                  </div>
                  {ev.tags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ev.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}