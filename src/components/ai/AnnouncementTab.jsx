import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Send, BookmarkCheck, AlertCircle, CheckCircle2, Copy, Lightbulb, Loader2 } from 'lucide-react';
import AudienceSelector from '@/components/announcements/AudienceSelector';

const exampleIntents = [
  "Remind Year 9 about the change to tomorrow's timetable",
  "Congratulate Year 7A on excellent behaviour this week",
  "Notify all staff about the SLT meeting on Friday at 4pm",
  "Remind students about the uniform policy",
];

export default function AnnouncementTab({ userEmail, userType, schoolId, onInsert }) {
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('Friendly');
  const [audience, setAudience] = useState(userType === 'admin' ? { scopeType: 'SCHOOL' } : { scopeType: 'CLASS' });
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(null);
  const [copied, setCopied] = useState(false);

  const audienceDescription = () => {
    if (audience.scopeType === 'SCHOOL') return 'the whole school';
    if (audience.scopeType === 'YEAR_GROUP') return audience.yearGroupName || 'the year group';
    if (audience.scopeType === 'CLASS') return audience.className || 'the class';
    if (audience.scopeType === 'TEAM') return audience.teamName || 'the team';
    if (audience.scopeType === 'STUDENTS') {
      const names = audience.studentNames || [];
      return names.length > 0 ? names.join(', ') : 'specific students';
    }
    return 'the audience';
  };

  const generate = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    setSaved(null);
    try {
      const res = await base44.functions.invoke('blockwardAI', {
        tool: 'DRAFT_ANNOUNCEMENT',
        message,
        tone,
        draftTarget: { type: audience.scopeType, description: audienceDescription() },
      });
      const data = res.data;
      if (!data.ok) {
        if (data.code === 'OPENAI_ERROR' && data.message?.includes('429')) {
          setError('AI is busy right now (rate limit). Please wait a moment and try again.');
        } else {
          setError(data.message || 'Generation failed.');
        }
      } else {
        setDraft(data);
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveAs = async (status) => {
    if (!draft) return;
    const isSend = status === 'sent';
    if (isSend) setSending(true); else setSaving(true);
    try {
      await base44.entities.Announcement.create({
        title: draft.title,
        body: draft.body,
        body_short: draft.body?.slice(0, 200),
        scope_type: audience.scopeType,
        year_group_id: audience.yearGroupId || undefined,
        year_group_name: audience.yearGroupName || undefined,
        class_id: audience.classId || undefined,
        class_name: audience.className || undefined,
        team_name: audience.teamName || undefined,
        student_emails: audience.studentEmails || undefined,
        student_names: audience.studentNames || undefined,
        status,
        created_by: userEmail,
        school_id: schoolId || undefined,
        sent_at: isSend ? new Date().toISOString() : undefined,
      });
      setSaved(status);
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Examples */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Try these examples</p>
        <div className="flex flex-wrap gap-2">
          {exampleIntents.map(ex => (
            <button
              key={ex}
              onClick={() => setMessage(ex)}
              className="text-xs px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-left"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">What do you want to announce?</Label>
          <Textarea
            placeholder="e.g. Remind Year 10 parents about the parents' evening on Thursday at 5pm in the main hall"
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="mt-1.5 resize-none min-h-[80px]"
          />
        </div>

        {/* Audience */}
        <AudienceSelector
          value={audience}
          onChange={setAudience}
          userType={userType}
          userEmail={userEmail}
          schoolId={schoolId}
        />

        {/* Tone */}
        <div>
          <Label className="text-sm font-medium">Tone</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Friendly">Friendly</SelectItem>
              <SelectItem value="Formal">Formal</SelectItem>
              <SelectItem value="Short">Short & Direct</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={generate} disabled={loading || !message.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Generating draft...' : 'Generate Announcement Draft'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {draft && (
        <div className="space-y-4 border border-indigo-200 rounded-xl p-5 bg-gradient-to-br from-indigo-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <h3 className="font-semibold text-slate-900">{draft.title}</h3>
            </div>
            <button
              onClick={() => copyToClipboard(draft.body)}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {draft.body}
          </div>

          {draft.bullets?.length > 0 && (
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium text-slate-600">Key points</span>
              </div>
              <ul className="space-y-1">
                {draft.bullets.map((b, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onInsert && (
            <Button
              variant="outline"
              onClick={() => onInsert(draft)}
              className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              Insert into Composer
            </Button>
          )}

          {saved ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              {saved === 'sent' ? 'Announcement sent and saved!' : 'Draft saved successfully!'}
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => saveAs('draft')} disabled={saving || sending} className="flex-1 gap-2 border-slate-300">
                <BookmarkCheck className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button onClick={() => saveAs('sent')} disabled={saving || sending} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                <Send className="h-4 w-4" />
                {sending ? 'Sending...' : 'Send Now'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}