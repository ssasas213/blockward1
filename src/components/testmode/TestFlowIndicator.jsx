/**
 * TestFlowIndicator — A testing utility shown inside the Test Mode menu.
 * Loads the latest StudentRecord in the test school and computes the 5
 * lifecycle stages from the ACTUAL record data (no fake workflow).
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useSchool } from '@/lib/SchoolContext';
import { Check, Minus } from 'lucide-react';

export default function TestFlowIndicator() {
  const { testMode } = useSchool();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!testMode?.isTestSuperUser || !testMode.testSchool?.id) return;
    let active = true;
    const load = async () => {
      try {
        const recs = await base44.entities.StudentRecord.filter(
          { school_id: testMode.testSchool.id }, '-created_date', 1
        );
        if (active) setRecord(recs[0] || null);
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    };
    load();
    const unsub = base44.entities.StudentRecord.subscribe(() => load());
    return () => { active = false; unsub(); };
  }, [testMode?.isTestSuperUser, testMode?.testSchool?.id, testMode?.activePersona]);

  if (!testMode?.isTestSuperUser) return null;

  const stages = [
    { label: 'Student Submission', done: !!record && record.status !== 'draft' },
    { label: 'Teacher Signature', done: !!record?.teacher_signed },
    { label: 'Admin Approval', done: !!record?.admin_signed },
    { label: 'Vault Delivery', done: !!record && record.status === 'delivered_to_vault' },
    { label: 'Verification', done: !!record?.verify_id },
  ];

  return (
    <div className="px-2 py-2 mx-1 mb-1 rounded-lg bg-muted/40 border border-border">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Test Flow</p>
      {loading ? (
        <p className="text-xs text-muted-foreground px-1 py-1">Loading…</p>
      ) : !record ? (
        <p className="text-xs text-muted-foreground px-1 py-1">No test record yet. Create one as Student.</p>
      ) : (
        <div className="space-y-1">
          {stages.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-xs px-1">
              <span className="text-muted-foreground">{s.label}</span>
              {s.done
                ? <Check className="h-3.5 w-3.5 text-success" />
                : <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}