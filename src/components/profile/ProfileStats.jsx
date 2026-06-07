import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, FileText, Shield, HardDrive, Users, BookOpen, CheckCircle2 } from 'lucide-react';

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
          { label: 'NFTs Received', value: blockWards.length, icon: Shield, color: 'text-violet-600 bg-violet-50' },
          { label: 'Records Created', value: records.length, icon: FileText, color: 'text-blue-600 bg-blue-50' },
          { label: 'Minted Achievements', value: minted.length, icon: Trophy, color: 'text-amber-600 bg-amber-50' },
          { label: 'Drive Documents', value: archived.length, icon: HardDrive, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Pending Review', value: pending.length, icon: CheckCircle2, color: 'text-orange-600 bg-orange-50' },
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
          { label: 'Classes', value: classes.length, icon: BookOpen, color: 'text-violet-600 bg-violet-50' },
          { label: 'Students Managed', value: studentSet.size, icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: 'Records Signed', value: signed.length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Awaiting Signature', value: pending.length, icon: FileText, color: 'text-orange-600 bg-orange-50' },
          { label: 'NFTs Issued', value: blockWards.length, icon: Shield, color: 'text-amber-600 bg-amber-50' },
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
          { label: 'Students', value: students.length, icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: 'Teachers', value: teachers.length, icon: BookOpen, color: 'text-violet-600 bg-violet-50' },
          { label: 'Total Records', value: records.length, icon: FileText, color: 'text-slate-600 bg-slate-50' },
          { label: 'Pending Approvals', value: pending.length, icon: CheckCircle2, color: 'text-orange-600 bg-orange-50' },
          { label: 'NFTs Minted', value: minted.length, icon: Trophy, color: 'text-amber-600 bg-amber-50' },
        ]);
      }
    } catch (e) {
      // silent
    }
  };

  if (!stats) return null;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Digital Custodian Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-xl p-4 text-center ${s.color.split(' ')[1]}`}>
                <Icon className={`h-6 w-6 mx-auto mb-2 ${s.color.split(' ')[0]}`} />
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}