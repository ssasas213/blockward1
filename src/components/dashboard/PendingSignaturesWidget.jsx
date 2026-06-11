import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PenLine, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Reusable widget showing records that need the current user's signature.
 * Pass `role` as "teacher" or "admin" to set the right filter status.
 * Pass `targetPage` as the page to navigate to for the full queue.
 */
export default function PendingSignaturesWidget({ userEmail, schoolId, role = 'teacher', targetPage = 'TeacherRecords' }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const awaitingStatus = role === 'admin' ? 'awaiting_admin_signature' : 'awaiting_teacher_signature';

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    loadPending();
  }, [schoolId]);

  const loadPending = async () => {
    try {
      const all = await base44.entities.StudentRecord.filter({ school_id: schoolId }, '-created_date');
      let pending;
      if (role === 'admin') {
        pending = all.filter(r => r.status === awaitingStatus);
      } else {
        // Teachers only see records from their assigned students
        pending = all.filter(r =>
          r.status === awaitingStatus &&
          (r.teacher_email === userEmail || !r.teacher_email)
        );
      }
      setRecords(pending.slice(0, 5));
    } catch (e) {
      // silently fail on widget
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5 flex items-center justify-center h-24">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </CardContent>
    </Card>
  );

  return (
    <Card className={`border-0 shadow-md ${records.length > 0 ? 'ring-2 ring-orange-400' : ''}`}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${records.length > 0 ? 'bg-orange-100' : 'bg-slate-100'}`}>
            <PenLine className={`h-5 w-5 ${records.length > 0 ? 'text-orange-600' : 'text-slate-400'}`} />
          </div>
          <div>
            <CardTitle className="text-base">
              Pending Signatures
              {records.length > 0 && (
                <Badge className="ml-2 bg-orange-500 text-white text-xs">{records.length}</Badge>
              )}
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Records awaiting your digital signature</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={createPageUrl(targetPage)}>
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {records.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-slate-400">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <p className="text-sm">All caught up — no pending signatures!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(record => (
              <Link
                key={record.id}
                to={createPageUrl(`RecordDetail?id=${record.id}`)}
                className="flex items-center gap-3 p-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-orange-200 flex items-center justify-center font-bold text-orange-700 text-sm flex-shrink-0">
                  {record.student_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{record.title}</p>
                  <p className="text-xs text-slate-500 truncate">{record.student_name}</p>
                </div>
                <PenLine className="h-4 w-4 text-orange-500 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}