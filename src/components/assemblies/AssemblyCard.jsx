import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, MapPin, User, Users } from 'lucide-react';
import { format } from 'date-fns';

const AUDIENCE_LABELS = {
  whole_school: 'Whole School', year_group: 'Year Group', selected_classes: 'Selected Classes', staff: 'Staff', custom: 'Custom',
};

export default function AssemblyCard({ assembly, action }) {
  const cancelled = assembly.status === 'cancelled';
  return (
    <Card className={`surface-card card-hover ${cancelled ? 'opacity-60' : ''}`}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-primary/10 text-primary">Assembly</Badge>
              <Badge variant="secondary">{AUDIENCE_LABELS[assembly.audience] || assembly.audience}</Badge>
              {cancelled && <Badge className="bg-destructive/15 text-destructive">Cancelled</Badge>}
            </div>
            <h3 className="font-semibold text-foreground text-sm">{assembly.title}</h3>
          </div>
          {action}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {assembly.start_time && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(assembly.start_time), 'EEE d MMM yyyy')}</span>}
          {assembly.start_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(assembly.start_time), 'HH:mm')}{assembly.end_time ? `–${format(new Date(assembly.end_time), 'HH:mm')}` : ''}</span>}
          {assembly.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{assembly.location}</span>}
          {assembly.organiser && <span className="flex items-center gap-1"><User className="h-3 w-3" />{assembly.organiser}</span>}
        </div>
        {assembly.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{assembly.description}</p>}
        {assembly.year_group_names?.length > 0 && <p className="text-xs text-muted-foreground mt-1">Year groups: {assembly.year_group_names.join(', ')}</p>}
      </CardContent>
    </Card>
  );
}