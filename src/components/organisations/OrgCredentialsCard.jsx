import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, ExternalLink, ShieldCheck, Loader2, XCircle, Clock } from 'lucide-react';

const ANCHOR_BADGES = {
  confirmed: { variant: 'success', label: 'On Polygon', Icon: ShieldCheck },
  processing: { variant: 'info', label: 'Anchoring…', Icon: Loader2 },
  pending: { variant: 'secondary', label: 'Anchor pending', Icon: Clock },
  failed: { variant: 'destructive', label: 'Anchor failed', Icon: XCircle },
};

/**
 * OrgCredentialsCard — credentials this organisation has issued, with their
 * live blockchain anchor state and public verification links.
 */
export default function OrgCredentialsCard({ credentials }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-5 w-5 text-primary" />
          Issued credentials
          {credentials.length > 0 && <Badge variant="secondary">{credentials.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {credentials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium text-foreground">No credentials issued yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Completed verifications produce a credential anchored to Polygon.
            </p>
          </div>
        ) : credentials.map((c) => {
          const ab = ANCHOR_BADGES[c.anchor_status] || ANCHOR_BADGES.pending;
          return (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                  <Badge variant={ab.variant} className="gap-1">
                    <ab.Icon className={`h-3 w-3 ${c.anchor_status === 'processing' ? 'animate-spin' : ''}`} />
                    {ab.label}
                  </Badge>
                  {c.status === 'revoked' && <Badge variant="destructive">Revoked</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.bw_id}
                  {c.holder_display_name ? ` · ${c.holder_display_name}` : ''}
                  {c.verified_at ? ` · verified ${new Date(c.verified_at).toLocaleDateString()}` : ''}
                  {c.blockchain?.network ? ` · ${c.blockchain.network.replace('_', ' ')}` : ''}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to={c.verify_url} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5" /> Verify
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}