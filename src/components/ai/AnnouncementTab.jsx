import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, Send, BookmarkCheck, AlertCircle, CheckCircle2, Copy } from 'lucide-react';

const audienceOptions = [
  { value: 'whole_school', label: 'Whole School' },
  { value: 'year_7', label: 'Year 7' },
  { value: 'year_8', label: 'Year 8' },
  { value: 'year_9', label: 'Year 9' },
  { value: 'year_10', label: 'Year 10' },
  { value: 'year_11', label: 'Year 11' },
  { value: 'staff_only', label: 'Staff Only' },
];

const exampleIntents = [
  'Remind parents about the upcoming sports day',
  'Notify Year 9 about a change to tomorrow\'s timetable',
  'Congratulate students on excellent behaviour this week',
  'Remind students about uniform policy',
];

export default function AnnouncementTab({ userEmail }) {
  const [intent, setIntent] = useState('');
  const [audience, setAudience] = useState('whole_school');
  const [tone, setTone] = useState('friendly');
  const [keyDetails, setKeyDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(null); // 'draft' | 'sent'
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!intent.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    setSaved(null);
    try {
      const res = await base44.functions.invoke('aiDraftAnnouncement', { intent, audience, tone, keyDetails });
      setDraft(res.data);
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
        body: draft.messageLong,
        body_short: draft.messageShort,
        audience,
        status,
        created_by: userEmail,
        sent_at: isSend ? new Date().toISOString() : undefined
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
      {/* Example intents */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Try these examples</p>
        <div className="flex flex-wrap gap-2">
          {exampleIntents.map(ex => (
            <button
              key={ex}
              onClick={() => setIntent(ex)}
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
            value={intent}
            onChange={e => setIntent(e.target.value)}
            className="mt-1.5 resize-none min-h-[80px]"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Key details (optional)</Label>
          <Input
            placeholder="e.g. Date: Thursday 6pm, Location: Main Hall, Dress code: smart casual"
            value={keyDetails}
            onChange={e => setKeyDetails(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <Label className="text-sm font-medium">Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {audienceOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <Label className="text-sm font-medium">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="short">Short & direct</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={generate} disabled={loading || !intent.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Sparkles className="h-4 w-4" />
          {loading ? 'Generating draft...' : 'Generate Announcement Draft'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Draft output */}
      {draft && (
        <div className="space-y-4 border border-indigo-200 rounded-xl p-5 bg-gradient-to-br from-indigo-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <h3 className="font-semibold text-slate-900">{draft.title}</h3>
            </div>
            <button
              onClick={() => copyToClipboard(draft.messageLong)}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <Tabs defaultValue="full">
            <TabsList className="h-8">
              <TabsTrigger value="full" className="text-xs">Full version</TabsTrigger>
              <TabsTrigger value="short" className="text-xs">Short version</TabsTrigger>
            </TabsList>
            <TabsContent value="short" className="mt-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {draft.messageShort}
              </div>
            </TabsContent>
            <TabsContent value="full" className="mt-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {draft.messageLong}
              </div>
            </TabsContent>
          </Tabs>

          {saved ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              {saved === 'sent'
                ? 'Announcement marked as sent and saved!'
                : 'Draft saved successfully!'}
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => saveAs('draft')}
                disabled={saving || sending}
                className="flex-1 gap-2 border-slate-300"
              >
                <BookmarkCheck className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                onClick={() => saveAs('sent')}
                disabled={saving || sending}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              >
                <Send className="h-4 w-4" />
                {sending ? 'Sending...' : 'Mark as Sent'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}