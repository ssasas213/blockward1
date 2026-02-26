import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from '@/api/base44Client';
import { Loader2, CalendarDays, CheckCircle2, ExternalLink } from 'lucide-react';

const AUDIENCE_OPTIONS = [
  { value: 'whole_school', label: 'Whole School' },
  { value: 'staff_only', label: 'Staff Only' },
  { value: 'year_7', label: 'Year 7' },
  { value: 'year_8', label: 'Year 8' },
  { value: 'year_9', label: 'Year 9' },
  { value: 'year_10', label: 'Year 10' },
  { value: 'year_11', label: 'Year 11' },
];

export default function ImportCalendarDialog({ open, onOpenChange, onImported }) {
  const [icsUrl, setIcsUrl] = useState('');
  const [audience, setAudience] = useState('whole_school');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!icsUrl.trim()) {
      setError('Please enter a calendar URL');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('importICSCalendar', {
        ics_url: icsUrl.trim(),
        audience,
      });
      const data = res.data;
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        onImported?.();
      }
    } catch (e) {
      setError(e.message || 'Failed to import calendar');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIcsUrl('');
    setAudience('whole_school');
    setResult(null);
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-violet-600" />
            Import External Calendar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">Supports Google Calendar, Outlook & Apple Calendar</p>
            <p>Paste a public ICS/iCal URL to import upcoming events (next 6 months, max 50 events).</p>
            <a
              href="https://support.google.com/calendar/answer/37648"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-violet-600 hover:underline text-xs"
            >
              How to get your Google Calendar ICS URL <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {result ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="font-semibold text-slate-900">Import successful!</p>
              <p className="text-slate-600 text-sm">
                Imported <strong>{result.imported}</strong> upcoming events
                {result.total_found > result.imported && ` (${result.total_found} found, filtered to next 6 months)`}.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label>Calendar ICS URL *</Label>
                <Input
                  value={icsUrl}
                  onChange={e => setIcsUrl(e.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/..."
                  className="mt-1.5 font-mono text-xs"
                />
              </div>

              <div>
                <Label>Audience for imported events</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={loading} className="bg-violet-600 hover:bg-violet-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarDays className="h-4 w-4 mr-2" />}
              Import Events
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}