import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, Building2, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { StatusDot } from '@/components/ui/status';

/**
 * Identity + context switcher for the sidebar. Surfaces the signed-in user's
 * current context (Personal holder, or an organisation they own/are a member
 * of) and lets multi-context users switch.
 *
 * Contexts come from already-loaded SchoolContext data (no extra queries):
 *  - Personal: always present (the holder identity).
 *  - Organisation: from activeSchool / managedSchools (organisation owners).
 *
 * Switching organisation calls switchSchool (server-side, already wired).
 * Switching to Personal is a no-op visual context for now — holders and org
 * members share one Blockward account.
 */
export default function ContextSwitcher({ profile, activeSchool, managedSchools, onSwitchSchool }) {
  const [open, setOpen] = useState(false);
  const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Blockward';
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'BW';

  const orgContexts = (managedSchools || []).filter(Boolean);
  const hasOrgContext = orgContexts.length > 0;
  const activeIsOrg = !!activeSchool;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-sidebar-border bg-black/20 hover:bg-hover hover:border-primary/30 transition-colors text-left"
          aria-label="Switch context"
        >
          <span className="h-7 w-7 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center text-[11px] font-semibold text-primary flex-shrink-0">
            {initials}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">{name}</p>
            <p className="text-[11px] text-tertiary truncate leading-tight">
              {activeIsOrg ? (activeSchool.name || 'Organisation') : 'Personal'}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[11px] text-tertiary uppercase tracking-wider">
          Switch context
        </DropdownMenuLabel>

        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => { setOpen(false); }}
        >
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm">Personal</span>
          {!activeIsOrg && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>

        {hasOrgContext && <DropdownMenuSeparator />}

        {orgContexts.map((org) => {
          const isActive = activeSchool?.id === org.id;
          const verified = org.verification_status === 'verified' || org.status === 'active';
          return (
            <DropdownMenuItem
              key={org.id}
              className="cursor-pointer"
              onClick={() => { onSwitchSchool?.(org.id); setOpen(false); }}
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm truncate">{org.name}</span>
              <StatusDot tone={verified ? 'green' : 'amber'} className="ml-1" />
              {isActive && <Check className="h-4 w-4 text-primary ml-1" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}