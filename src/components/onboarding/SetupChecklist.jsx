import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Check, CheckCircle2, Building2, KeyRound, Users, BookOpen, GraduationCap, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SetupChecklist() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState({
    school_created: false,
    school_profile: false,
    teacher_code: false,
    first_teacher: false,
    first_class: false,
    first_student: false,
    first_achievement: false,
  });

  useEffect(() => { loadChecklist(); }, []);

  const loadChecklist = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const profile = profiles[0];
      if (!profile?.school_id) { setLoading(false); return; }
      const schoolId = profile.school_id;

      const [school, codes, teachers, classes, enrollments, records] = await Promise.all([
        base44.entities.School.filter({ id: schoolId }),
        base44.entities.SchoolCode.filter({ school_id: schoolId, status: 'active' }),
        base44.entities.StaffMembership.filter({ school_id: schoolId, status: 'active' }),
        base44.entities.Class.filter({ school_id: schoolId }),
        base44.entities.Enrollment.filter({ school_id: schoolId, status: 'active' }),
        base44.entities.StudentRecord.filter({ school_id: schoolId, status: 'delivered_to_vault' }),
      ]);

      setItems({
        school_created: school.length > 0,
        school_profile: school.length > 0 && (school[0].logo_url || school[0].website || school[0].address),
        teacher_code: codes.some(c => c.role_type === 'teacher'),
        first_teacher: teachers.length > 0,
        first_class: classes.length > 0,
        first_student: enrollments.length > 0,
        first_achievement: records.length > 0,
      });
    } catch (error) {
      console.error('Error loading checklist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const checklist = [
    { key: 'school_created', label: 'School created', icon: Building2, link: '/SystemSettings' },
    { key: 'school_profile', label: 'School profile completed', icon: CheckCircle2, link: '/SystemSettings' },
    { key: 'teacher_code', label: 'Teacher code generated', icon: KeyRound, link: '/SchoolCodes' },
    { key: 'first_teacher', label: 'First teacher invited', icon: Users, link: '/ManageUsers' },
    { key: 'first_class', label: 'First class created', icon: BookOpen, link: '/Classes' },
    { key: 'first_student', label: 'First student joined', icon: GraduationCap, link: '/ManageUsers' },
    { key: 'first_achievement', label: 'First achievement approved', icon: Award, link: '/AdminApprovalQueue' },
  ];

  const completedCount = checklist.filter(c => items[c.key]).length;
  const allDone = completedCount === checklist.length;

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Setup Checklist</h3>
          <span className="text-xs text-muted-foreground">{completedCount}/{checklist.length} complete</span>
        </div>

        {allDone && (
          <div className="mb-3 p-2.5 rounded-lg bg-success/10 border border-success/20 text-xs text-success flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> All setup steps complete!
          </div>
        )}

        <div className="space-y-1">
          {checklist.map((item) => {
            const done = items[item.key];
            return (
              <Link
                key={item.key}
                to={item.link}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                  done ? "opacity-50" : "hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 border",
                  done ? "bg-success/10 border-success/30" : "border-border"
                )}>
                  {done ? <Check className="h-3.5 w-3.5 text-success" /> : <item.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <span className={cn("text-sm", done ? "text-muted-foreground line-through" : "text-foreground")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}