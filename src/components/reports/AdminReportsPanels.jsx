import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from '@/components/ui/empty-state';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { subDays, format } from 'date-fns';

function toCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}

function downloadCsv(name, rows) {
  const csv = toCsv(rows);
  if (!csv) { toast.error('Nothing to export'); return; }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function RowTable({ rows, empty }) {
  if (!rows || rows.length === 0) return <EmptyState title={empty || 'No data in this range'} />;
  const keys = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {keys.map(k => <th key={k} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{k.replace(/_/g, ' ')}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {keys.map(k => <td key={k} className="px-3 py-2 whitespace-nowrap text-foreground/90">{r[k] === null || r[k] === undefined ? '—' : String(r[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && <p className="px-3 py-2 text-xs text-muted-foreground">Showing first 100 of {rows.length} rows — export includes all of them.</p>}
    </div>
  );
}

/**
 * AdminReportsPanels — authorised report datasets & CSV exports for the
 * organisation admin: grades, assignment completion, classroom attendance,
 * register completion, points and verified achievements. Authorisation and
 * organisation scoping are enforced server-side in adminReportsData.
 */
export default function AdminReportsPanels() {
  const [range, setRange] = useState('30');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const to = format(new Date(), 'yyyy-MM-dd');
      const from = format(subDays(new Date(), Number(range) - 1), 'yyyy-MM-dd');
      const res = await base44.functions.invoke('adminReportsData', { from, to });
      const d = res.data || {};
      if (!d.ok) throw new Error(d.error || 'Failed to run reports');
      setData(d);
    } catch (e) {
      toast.error(e.message || 'Failed to run reports');
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const exportRows = (name, rows) => downloadCsv(`${name}-${format(new Date(), 'yyyy-MM-dd')}.csv`, rows);

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Reports &amp; exports</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Grades, assignment completion, attendance, registers, points and verified achievements — your organisation only</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !data ? (
          <EmptyState title="Reports unavailable" />
        ) : (
          <Tabs defaultValue="grades">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="grades">Grades</TabsTrigger>
              <TabsTrigger value="assignments">Assignment completion</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="registers">Registers</TabsTrigger>
              <TabsTrigger value="points">Points</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
            </TabsList>

            <TabsContent value="grades" className="mt-4 space-y-3">
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => exportRows('grades', data.grades?.rows)}><Download className="h-4 w-4 mr-1" /> Export CSV</Button></div>
              <RowTable rows={data.grades?.rows} empty="No published grades in this range" />
            </TabsContent>

            <TabsContent value="assignments" className="mt-4 space-y-3">
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => exportRows('assignment-completion', data.assignment_completion)}><Download className="h-4 w-4 mr-1" /> Export CSV</Button></div>
              <RowTable rows={data.assignment_completion} empty="No published classwork in this range" />
            </TabsContent>

            <TabsContent value="attendance" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">BlockWard classroom records — not statutory MIS attendance.</p>
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => exportRows('attendance', data.attendance)}><Download className="h-4 w-4 mr-1" /> Export CSV</Button></div>
              <RowTable rows={data.attendance} empty="No registers taken in this range" />
            </TabsContent>

            <TabsContent value="registers" className="mt-4 space-y-3">
              <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => exportRows('register-completion', data.register_completion)}><Download className="h-4 w-4 mr-1" /> Export CSV</Button></div>
              <RowTable rows={data.register_completion} empty="No timetable entries found" />
            </TabsContent>

            <TabsContent value="points" className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="mr-2" onClick={() => exportRows('points-by-category', data.points?.by_category)}><Download className="h-4 w-4 mr-1" /> By category</Button>
                <Button size="sm" variant="outline" onClick={() => exportRows('points-by-student', data.points?.by_student)}><Download className="h-4 w-4 mr-1" /> By student</Button>
              </div>
              <RowTable rows={data.points?.by_category} empty="No points issued in this range" />
              <RowTable rows={data.points?.by_student} />
            </TabsContent>

            <TabsContent value="achievements" className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="mr-2" onClick={() => exportRows('achievements-by-category', data.verified_achievements?.by_category)}><Download className="h-4 w-4 mr-1" /> By category</Button>
                <Button size="sm" variant="outline" onClick={() => exportRows('achievements-by-anchor', data.verified_achievements?.by_anchor_status)}><Download className="h-4 w-4 mr-1" /> By anchor</Button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">Verified credentials</p><p className="text-xl font-bold">{data.verified_achievements?.total || 0}</p></div>
                <div className="p-3 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">Revoked</p><p className="text-xl font-bold">{data.verified_achievements?.revoked || 0}</p></div>
                <div className="p-3 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">Hash mismatches</p><p className="text-xl font-bold">{data.verified_achievements?.chain_mismatch || 0}</p></div>
                <div className="p-3 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">Point entries</p><p className="text-xl font-bold">{data.points?.total_entries || 0}</p></div>
              </div>
              <RowTable rows={data.verified_achievements?.by_category} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}