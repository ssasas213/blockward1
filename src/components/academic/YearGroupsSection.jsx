import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Archive, ArchiveRestore } from 'lucide-react';
import { toast } from 'sonner';

/**
 * YearGroupsSection — organisation admins manage year groups, including
 * archiving a finished year. Archiving hides a year group from active use
 * without deleting anything — its history stays fully queryable.
 *
 * Mutations go through the academicSettingsAction backend function —
 * BlockWard authorises on UserProfile.user_type, not the platform role the
 * entity RLS checks. Reads stay on the school-scoped entity read.
 */
export default function YearGroupsSection({ schoolId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      setGroups(await base44.entities.YearGroup.filter({ school_id: schoolId }));
    } catch (e) { toast.error('Failed to load year groups'); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const mutate = async (payload, successMessage) => {
    const res = await base44.functions.invoke('academicSettingsAction', payload);
    if (!res.data?.ok) throw new Error(res.data?.error || 'This change could not be saved');
    if (successMessage) toast.success(successMessage);
  };

  const create = async () => {
    if (!name.trim()) { toast.error('A name is required'); return; }
    setSaving(true);
    try {
      await mutate({ entity: 'year_group', action: 'create', name: name.trim() }, 'Year group created');
      setName('');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toggleArchive = async (g) => {
    const archiving = g.status !== 'archived';
    if (archiving && !confirm(`Archive "${g.name}"? Its history is preserved and stays reportable.`)) return;
    setUpdatingId(g.id);
    try {
      await mutate(
        { entity: 'year_group', action: 'update', id: g.id, status: archiving ? 'archived' : 'active' },
        archiving ? 'Year group archived — history preserved' : 'Year group restored',
      );
      load();
    } catch (e) { toast.error(e.message); }
    finally { setUpdatingId(null); }
  };

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-primary" /> Year Groups</CardTitle>
          <CardDescription>Archive finished years without deleting history</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Year 9" className="max-w-xs" />
          <Button size="sm" onClick={create} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No year groups yet.</p>
        ) : (
          <div className="space-y-2">
            {groups.map(g => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground text-sm">{g.name}</p>
                  {g.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
                </div>
                <Button size="sm" variant={g.status === 'archived' ? 'outline' : 'ghost'} disabled={updatingId === g.id} onClick={() => toggleArchive(g)}>
                  {updatingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : g.status === 'archived' ? <><ArchiveRestore className="h-4 w-4 mr-1" /> Restore</> : <><Archive className="h-4 w-4 mr-1" /> Archive</>}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}