import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { base44 } from '@/api/base44Client';
import { Search, X, Loader2, UserPlus, AtSign } from 'lucide-react';

/**
 * TeamParticipantsEditor — picks teammates for a team achievement.
 * Search existing members of your organisation, or add anyone else by email.
 * Each participant gets a role (captain, striker, lead developer…).
 */
export default function TeamParticipantsEditor({ participants, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await base44.functions.invoke('searchTeamUsers', { query: query.trim() });
        setResults(res.data?.ok ? (res.data.results || []) : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const emails = new Set(participants.map((p) => (p.email || '').toLowerCase()));

  const addFound = (u) => {
    if (emails.has(u.email.toLowerCase())) return;
    onChange([...participants, { email: u.email, name: u.name, role: 'Member', handle: u.handle, avatar_url: u.avatar_url }]);
    setQuery('');
    setResults(null);
  };

  const addByEmail = () => {
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) return;
    if (emails.has(e)) { setEmail(''); return; }
    onChange([...participants, { email: e, name: '', role: 'Member' }]);
    setEmail('');
  };

  const setRole = (i, role) => onChange(participants.map((p, j) => (j === i ? { ...p, role } : p)));
  const remove = (i) => onChange(participants.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Add teammates</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people in your organisation by name, email or handle"
            className="pl-9"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-tertiary" />}
          {results && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              {results.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-muted-foreground">No members found — add them by email below.</p>
              ) : results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => addFound(u)}
                  disabled={emails.has(u.email.toLowerCase())}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-hover disabled:opacity-40"
                >
                  <InitialsAvatar name={u.name} src={u.avatar_url} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{u.name}</span>
                    {u.handle && <span className="block text-xs text-tertiary">@{u.handle}</span>}
                  </span>
                  {emails.has(u.email.toLowerCase())
                    ? <span className="text-xs text-tertiary">Added</span>
                    : <UserPlus className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addByEmail(); } }}
            placeholder="Not on BlockWard yet? Enter their email"
          />
          <Button type="button" variant="outline" onClick={addByEmail}>Add</Button>
        </div>
      </div>

      {participants.length > 0 && (
        <div className="space-y-2">
          {participants.map((p, i) => (
            <div key={p.email} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <InitialsAvatar name={p.name || p.email} src={p.avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {p.name || p.email}
                  {p.handle && <span className="ml-1.5 text-xs text-tertiary inline-flex items-center gap-0.5"><AtSign className="h-3 w-3" />{p.handle}</span>}
                </p>
                <p className="text-xs text-tertiary truncate">{p.name ? p.email : 'Invited by email'}</p>
              </div>
              <Input
                value={p.role}
                onChange={(e) => setRole(i, e.target.value)}
                placeholder="Role"
                className="h-8 w-32 text-xs"
              />
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Each teammate gets an email with a private link once the achievement is approved — they choose whether to accept.
          </p>
        </div>
      )}
    </div>
  );
}