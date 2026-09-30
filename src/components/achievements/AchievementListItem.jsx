import React from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import { resolveStatus, formatDate } from '@/lib/achievementStatus';

/**
 * Compact achievement list item for collections/dashboards. Clickable → opens
 * the detail drawer. Shows title, issuer, category · date, semantic status,
 * and credential ID when issued. Reserved, not overloaded with icons.
 */
export default function AchievementListItem({ item, onOpen }) {
  const status = resolveStatus(item);
  const a = item;
  const cat = (a.category || '').replace(/_/g, ' ');
  return (
    <button
      type="button"
      onClick={() => onOpen?.(a)}
      className="w-full text-left surface-card card-hover rounded-xl p-4 sm:p-5 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{a.title}</h3>
            <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', status.cls)}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-tertiary capitalize truncate">
            {cat}{a.date_achieved ? ` · ${formatDate(a.date_achieved)}` : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 truncate">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{a.issuer_org || 'No issuer connected'}</span>
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-tertiary flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {status.detail && (
          <span className={cn('font-medium', status.tone === 'green' ? 'text-success' : status.tone === 'red' ? 'text-destructive' : status.tone === 'amber' ? 'text-warning' : 'text-info')}>
            {status.detail}
          </span>
        )}
        {a.credential?.bw_id && (
          <span className="flex items-center gap-1 text-tertiary">
            <FileText className="h-3 w-3" /> {a.credential.bw_id}
          </span>
        )}
        {a.credential?.bw_id && (
          <Link
            to={`/verify/${a.credential.bw_id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Public page
          </Link>
        )}
      </div>
    </button>
  );
}