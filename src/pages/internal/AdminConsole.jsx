import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BlockwardMark } from '@/components/brand/BlockwardLogo';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ConsoleShell from '@/components/admin/ConsoleShell';
import ConsoleOverview from '@/components/admin/ConsoleOverview';
import OrgReviewQueue from '@/components/admin/OrgReviewQueue';
import OrgReviewDrawer from '@/components/admin/OrgReviewDrawer';
import CredentialOversight from '@/components/admin/CredentialOversight';
import ConsoleAuditLog from '@/components/admin/ConsoleAuditLog';

/** Blockward internal admin console. Auth + backend authorisation enforced
 *  server-side; this page only renders what the backend returns. */
export default function AdminConsole() {
  const [gate, setGate] = useState('checking');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    try {
      const st = await base44.functions.invoke('getInternalAdminStatus');
      if (!st.data?.is_internal_admin) { setGate('denied'); return; }
      setGate('ready');
      await load();
    } catch { setGate('denied'); }
  };

  const load = async () => {
    const res = await base44.functions.invoke('adminConsoleData', {});
    setData(res.data);
  };

  const openOrg = async (org) => {
    setSelectedOrg(org);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await base44.functions.invoke('adminConsoleData', { action: 'org_detail', org_id: org.id });
      setDetail(res.data);
    } catch { toast.error('Could not load organisation detail'); }
    finally { setDetailLoading(false); }
  };

  const onAction = async (org, type, reason) => {
    setActionBusy(true);
    try {
      const payload = type === 'request_info'
        ? { action: 'request_info', org_id: org.id, reason }
        : { action: 'set_org_status', org_id: org.id, status: type, reason };
      const res = await base44.functions.invoke('orgAction', payload);
      if (res.data?.ok) {
        toast.success(`${org.name} updated`);
        await load();
        await openOrg({ ...org, status: res.data.status });
      } else { toast.error(res.data?.error || 'Action failed'); }
    } catch (e) { toast.error(e?.response?.data?.error || 'Action failed'); }
    finally { setActionBusy(false); }
  };

  if (gate === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }
  if (gate === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="surface-card max-w-md w-full"><CardContent className="py-12 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4"><BlockwardMark className="h-7 w-7" /></div>
          <h1 className="text-lg font-semibold text-foreground">Access denied</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-5">This internal operations console is restricted to authorised Blockward staff.</p>
          <div className="flex justify-center gap-2">
            <Button asChild><a href="/Login">Sign in</a></Button>
            <Button variant="outline" asChild><a href="/">Back to Blockward</a></Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <ConsoleShell admin={data?.admin} tab={tab} setTab={setTab}>
      {tab === 'overview' && <ConsoleOverview data={data} onOpenOrg={openOrg} setTab={setTab} />}
      {tab === 'organisations' && <OrgReviewQueue orgs={data?.organisations || []} onOpenOrg={openOrg} />}
      {tab === 'credentials' && <CredentialOversight />}
      {tab === 'audit' && <ConsoleAuditLog entries={data?.overview?.recent_audit || []} />}

      <OrgReviewDrawer
        org={selectedOrg} detail={detail} loading={detailLoading}
        onAction={onAction} busy={actionBusy}
        onClose={() => { setSelectedOrg(null); setDetail(null); }}
      />
    </ConsoleShell>
  );
}