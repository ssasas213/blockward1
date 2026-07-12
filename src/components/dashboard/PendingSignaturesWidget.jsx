import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EmptyState from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { PenLine, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );

  return (
    <Card className={cn("shadow-sm", records.length > 0 && "border-warning/30")}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", records.length > 0 ? "bg-warning/10" : "bg-muted")}>
            <PenLine className={cn("h-4 w-4", records.length > 0 ? "text-warning" : "text-muted-foreground")} />
          </div>
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              Pending Signatures
              {records.length > 0 && (
                <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5">{records.length}</Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Records awaiting your digital signature</p>
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
          <div className="flex items-center gap-2 py-4">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <p className="text-sm text-muted-foreground">All caught up — no pending signatures.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {records.map(record => (
              <Link
                key={record.id}
                to={createPageUrl(`RecordDetail?id=${record.id}`)}
                className="flex items-center gap-3 p-3 bg-warning/5 hover:bg-warning/10 border border-warning/20 rounded-lg transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center font-medium text-warning text-sm flex-shrink-0">
                  {record.student_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{record.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{record.student_name}</p>
                </div>
                <PenLine className="h-4 w-4 text-warning flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}