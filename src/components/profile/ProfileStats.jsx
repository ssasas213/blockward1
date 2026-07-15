import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, FileText, Shield, HardDrive, Users, BookOpen, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProfileStats({ profile, userEmail }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!profile || !userEmail) return;
    load();
  }, [profile, userEmail]);

  const load = async () => {
    try {
      if (profile.user_type === 'student') {
        const [records, blockWards] = await Promise.all([
          base44.entities.StudentRecord.filter({ student_email: userEmail }),
          base44.entities.BlockWard.filter({ student_email: userEmail, status: 'active' }),
        ]);
        const minted = records.filter(r => r.status === 'minted' || r.status === 'archived');
        const pending = records.filter(r => !['minted', 'archived', 'rejected'].includes(r.status));
        const archived = records.filter(r => r.status === 'archived');
        setStats([
          { label: 'NFTs Received', value: blockWards.length, icon: Shield, accent: 'text-primary' },
          { label: 'Records Created', value: records.length, icon: FileText, accent: 'text-primary' },
          { label: 'Minted Achievements', value: minted.length, icon: Trophy, accent: 'text-accent' },
          { label: 'Drive Documents', value: archived.length, icon: HardDrive, accent: 'text-success' },
          { label: 'Pending Review', value: pending.length, icon: CheckCircle2, accent: 'text-warning' },
        ]);
      } else if (profile.user_type === 'teacher') {
        const [classes, records, blockWards] = await Promise.all([
          base44.entities.Class.filter({ teacher_email: userEmail }),
          base44.entities.StudentRecord.filter({ teacher_email: userEmail }),
          base44.entities.BlockWard.filter({ issuer_email: userEmail }),
        ]);
        const studentSet = new Set();
        classes.forEach(c => (c.student_emails || []).forEach(e => studentSet.add(e)));
        const signed = records.filter(r => r.teacher_signed);
        const pending = records.filter(r => r.status === 'awaiting_teacher_signature');
        setStats([
          { label: 'Classes', value: classes.length, icon: BookOpen, accent: 'text-primary' },
          { label: 'Students Managed', value: studentSet.size, icon: Users, accent: 'text-primary' },
          { label: 'Records Signed', value: signed.length, icon: CheckCircle2, accent: 'text-success' },
          { label: 'Awaiting Signature', value: pending.length, icon: FileText, accent: 'text-warning' },
          { label: 'NFTs Issued', value: blockWards.length, icon: Shield, accent: 'text-accent' },
        ]);
      } else if (profile.user_type === 'admin') {
        const [students, teachers, records] = await Promise.all([
          base44.entities.UserProfile.filter({ school_id: profile.school_id, user_type: 'student' }),
          base44.entities.UserProfile.filter({ school_id: profile.school_id, user_type: 'teacher' }),
          base44.entities.StudentRecord.filter({ school_id: profile.school_id }),
        ]);
        const pending = records.filter(r => r.status === 'awaiting_admin_signature');
        const minted = records.filter(r => r.status === 'minted' || r.status === 'archived');
        setStats([
          { label: 'Students', value: students.length, icon: Users, accent: 'text-primary' },
          { label: 'Teachers', value: teachers.length, icon: BookOpen, accent: 'text-primary' },
          { label: 'Total Records', value: records.length, icon: FileText, accent: 'text-primary' },
          { label: 'Pending Approvals', value: pending.length, icon: CheckCircle2, accent: 'text-warning' },
          { label: 'NFTs Minted', value: minted.length, icon: Trophy, accent: 'text-accent' },
        ]);
      }
    } catch (e) {
      // silent
    }
  };

  if (!stats) return null;

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <Trophy className="h-4 w-4 text-primary" /> Digital Custodian Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-xl p-4 text-center border border-border bg-muted/20 hover:border-primary/30 hover:bg-muted/30 transition-colors"
              >
                <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-muted/40 mb-2">
                  <Icon className={cn('h-5 w-5', s.accent)} />
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}