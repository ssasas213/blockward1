import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function StudentAssembliesWidget() {
  const [assemblies, setAssemblies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke('assemblyAction', { action: 'list' })
      .then(res => { if (res.data?.ok) setAssemblies(res.data.assemblies || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Card className="surface-card"><CardContent className="pt-6 flex items-center justify-center h-28"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  const next = assemblies.find(a => new Date(a.start_time) >= new Date());
  if (!next) return null;

  return (
    <Card className="surface-card card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Calendar className="h-4 w-4 text-primary" /></div>
          <div><p className="text-sm font-semibold text-foreground">Next Assembly</p><p className="text-xs text-muted-foreground">Upcoming</p></div>
        </div>
        <div className="p-3 rounded-lg bg-muted/40 border border-border">
          <p className="text-sm font-medium text-foreground">{next.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(next.start_time), 'EEE d MMM · HH:mm')}{next.location ? ` · ${next.location}` : ''}</p>
        </div>
        <Button variant="outline" size="sm" asChild className="w-full mt-3"><Link to={createPageUrl('Assemblies')}>View Assemblies</Link></Button>
      </CardContent>
    </Card>
  );
}