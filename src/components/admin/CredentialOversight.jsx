import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatDateTime } from '@/lib/achievementStatus';

const ANCHOR_TONE = { confirmed: 'text-success', failed: 'text-destructive', processing: 'text-warning', pending: 'text-tertiary' };

export default function CredentialOversight() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adminConsoleData', { action: 'search_credentials', q, status: status === 'all' ? '' : status });
      setResults(res.data?.credentials || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Credential oversight</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Search and inspect issued credentials. Read-only support — Blockward admins cannot fabricate issuer verification.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Credential ID, holder, issuer or title…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />} Search</Button>
      </div>

      {results === null ? (
        <Card className="surface-card"><CardContent className="py-10 text-center text-sm text-muted-foreground">Search to inspect issued credentials.</CardContent></Card>
      ) : results.length === 0 ? (
        <Card className="surface-card"><CardContent className="py-10 text-center text-sm text-muted-foreground">No credentials match.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {results.map((c) => {
            const bc = c.blockchain || {};
            return (
              <div key={c.id} className="surface-card card-hover rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{c.title}</h3>
                      <span className={cn('text-xs font-medium', ANCHOR_TONE[c.anchor_status] || 'text-tertiary')}>{c.anchor_status}</span>
                      {c.status === 'revoked' && <span className="text-xs text-destructive">Revoked</span>}
                    </div>
                    <p className="text-xs text-tertiary mt-0.5 truncate">{c.bw_id} · {c.holder_display_name} · {c.issuer_org}</p>
                    {bc.transaction_hash && <p className="text-xs text-tertiary mt-0.5 font-mono truncate">{bc.transaction_hash}</p>}
                  </div>
                  <a href={`/verify/${c.bw_id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1 flex-shrink-0"><ExternalLink className="h-3 w-3" /> Verify</a>
                </div>
                {c.verified_at && <p className="text-xs text-tertiary mt-1">Verified {formatDateTime(c.verified_at)}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}