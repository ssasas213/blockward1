import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ClipboardCheck, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Credentials Awaiting Approval — the org's primary action area. Shows the
// next records needing the owner's sign-off (data comes from the server);
// an accurate empty state when nothing is pending.
export default function AdminApprovalQueue({ items = [] }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="card-title">Credentials awaiting approval</h3>
          <p className="caption mt-0.5">Records that need your sign-off before they are issued and anchored on-chain.</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary shrink-0">
          <Link to={createPageUrl('PendingSignoffs')}>View all <ChevronRight className="h-4 w-4" /></Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <ClipboardCheck className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Nothing awaiting approval</p>
          <p className="caption mt-1">New achievement submissions will appear here for your review.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-hover/50 transition-colors">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{r.title}</p>
                <p className="caption truncate">{r.student_name}{r.category ? ` · ${r.category}` : ''}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}