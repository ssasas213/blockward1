import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from '@/api/base44Client';
import { Loader2, CalendarDays, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportCalendarDialog({ open, onOpenChange, schoolId, onImported }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('importICSCalendar', {
        ics_url: url.trim(),
        school_id: schoolId,
      });
      const data = res.data;
      if (data.ok) {
        setResult(data);
        toast.success(`Imported ${data.imported} event${data.imported !== 1 ? 's' : ''} successfully!`);
        onImported?.();
      } else {
        toast.error(data.message || 'Import failed');
      }
    } catch (e) {
      toast.error('Import failed. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setResult(null);
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
          <p className="text-sm text-slate-600">
            Paste a public calendar URL (ICS format) from Google Calendar, Outlook, or Apple Calendar to import upcoming events into BlockWard.
          </p>

          <div className="space-y-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
            <p className="font-semibold text-slate-700">How to get the ICS URL:</p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="font-medium text-violet-700 shrink-0">Google:</span>
                <span>Calendar Settings → Integrate calendar → <em>Public URL to this calendar</em> (copy the ICS link)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium text-violet-700 shrink-0">Outlook:</span>
                <span>Calendar → Share → Publish → copy the ICS link</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium text-violet-700 shrink-0">Apple:</span>
                <span>Calendar → Share → Public Calendar → copy link, change <code>webcal://</code> to <code>https://</code></span>
              </div>
            </div>
          </div>

          <div>
            <Label>Calendar URL (ICS)</Label>
            <Input
              className="mt-1.5 font-mono text-sm"
              placeholder="https://calendar.google.com/calendar/ical/.../.../basic.ics"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>

          {result && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold">Import complete!</p>
                <p className="text-xs text-green-700">
                  {result.imported} upcoming event{result.imported !== 1 ? 's' : ''} imported
                  {result.total_found > result.imported ? ` (${result.total_found} total found, past events skipped)` : ''}.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={loading || !url.trim()} className="bg-violet-600 hover:bg-violet-700 gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              {loading ? 'Importing...' : 'Import Events'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}