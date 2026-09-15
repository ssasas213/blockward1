import React from 'react';
import InitialsAvatar from '@/components/ui/InitialsAvatar';

// Every organisation this student belongs to — home school plus approved
// cross-org memberships. Rendered as its own reorderable profile section.
export default function OrganisationsChips({ orgs }) {
  if (!orgs?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {orgs.map((o) => (
        <span key={o.id || o.name} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1">
          {o.logo_url ? (
            <img src={o.logo_url} alt="" className="h-4 w-4 rounded object-cover" />
          ) : (
            <InitialsAvatar name={o.name} size="xs" />
          )}
          <span className="text-xs font-medium text-foreground">{o.name}</span>
        </span>
      ))}
    </div>
  );
}