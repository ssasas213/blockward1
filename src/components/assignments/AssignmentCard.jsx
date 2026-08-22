import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, BookOpen, User, Paperclip, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function AssignmentCard({ assignment }) {
  const dueBadge = () => {
    switch (assignment.due_status) {
      case 'overdue': return <Badge className="bg-destructive/15 text-destructive">Overdue</Badge>;
      case 'due_today': return <Badge className="bg-warning/15 text-warning">Due Today</Badge>;
      case 'due_soon': return <Badge className="bg-primary/10 text-primary">Due Soon</Badge>;
      case 'upcoming': return <Badge variant="secondary">Upcoming</Badge>;
      default: return <Badge variant="secondary">No due date</Badge>;
    }
  };
  const gradeBadge = () => {
    if (assignment.grade_status === 'graded') {
      return <Badge className="bg-success/15 text-success">Graded {assignment.percentage != null ? `${assignment.percentage}%` : ''}</Badge>;
    }
    if (assignment.grade_status === 'submitted') return <Badge variant="secondary">Submitted</Badge>;
    return <Badge variant="outline">Not submitted</Badge>;
  };
  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="capitalize text-[10px]">{assignment.assessment_type?.replace('_', ' ')}</Badge>
              {dueBadge()}
              {assignment.grade_status && gradeBadge()}
            </div>
            <h3 className="font-semibold text-foreground text-sm">{assignment.title}</h3>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {assignment.subject && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{assignment.subject}</span>}
          {assignment.class_name && <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{assignment.class_name}</span>}
          {assignment.teacher_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{assignment.teacher_name}</span>}
          {assignment.due_date && <span className="flex items-center gap-1 font-medium"><Calendar className="h-3 w-3" />Due {format(new Date(assignment.due_date), 'EEE d MMM')}</span>}
        </div>
        {assignment.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{assignment.description}</p>}
        {assignment.attachment_url && <span className="inline-flex items-center gap-1 text-xs text-primary mt-2"><Paperclip className="h-3 w-3" />Attachment</span>}
      </CardContent>
    </Card>
  );
}