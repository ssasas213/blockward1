import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
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

const ROLE_LABEL = { owner: 'Organisation Owner', verifier: 'Verifier' };

/**
 * Identity + context switcher for the sidebar. Surfaces the signed-in user's
 * current context (Personal holder, or an organisation they own / are an
 * active verifier of) and lets multi-context users switch.
 *
 * Org contexts come from SchoolContext.organisations — active OrganisationMember
 * records resolved against IssuerOrganisation. Switching organisation persists
 * the choice (localStorage 'bw_context_pref') so refreshes and sign-ins return
 * to the same workspace; switching to Personal persists that choice too.
 *
 * Membership is enforced server-side by orgDashboardData — a stale or spoofed
 * org id simply fails to load data. This switcher never grants access.
 */
export default function ContextSwitcher({ profile, organisations, activeOrgId, onSelectPersonal, onSelectOrg }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Blockward';
  const initials = name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase() || 'BW';

  const orgContexts = (organisations || []).filter(Boolean);
  const isOrgRoute = location.pathname.startsWith('/organisations');
  const activeOrg = orgContexts.find((o) => o.id === activeOrgId) || null;
  const activeLabel = isOrgRoute && activeOrg ? (activeOrg.name || 'Organisation') : 'Personal';

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
            <p className="text-[11px] text-tertiary truncate leading-tight">{activeLabel}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[11px] text-tertiary uppercase tracking-wider">
          Switch context
        </DropdownMenuLabel>

        <DropdownMenuItem className="cursor-pointer" onClick={() => { setOpen(false); onSelectPersonal?.(); }}>
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">Personal</p>
            <p className="text-[11px] text-tertiary">Holder — your achievements</p>
          </div>
          {!isOrgRoute && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>

        {orgContexts.length > 0 && <DropdownMenuSeparator />}

        {orgContexts.map((org) => {
          const isActive = isOrgRoute && activeOrgId === org.id;
          const verified = org.status === 'verified';
          return (
            <DropdownMenuItem
              key={org.id}
              className="cursor-pointer"
              onClick={() => { setOpen(false); onSelectOrg?.(org.id); }}
            >
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{org.name}</p>
                <p className="text-[11px] text-tertiary truncate">{ROLE_LABEL[org.role] || 'Member'}</p>
              </div>
              <StatusDot tone={verified ? 'green' : 'amber'} className="ml-1" />
              {isActive && <Check className="h-4 w-4 text-primary ml-1" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}