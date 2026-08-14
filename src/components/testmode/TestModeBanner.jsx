import React from 'react';
import { FlaskConical, GraduationCap, Users, Shield, RotateCcw } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useSchool } from '@/lib/SchoolContext';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PERSONA_DASHBOARDS = {
  student: 'StudentDashboard',
  teacher: 'TeacherDashboard',
  admin: 'AdminDashboard',
};
const PERSONA_ICONS = { student: GraduationCap, teacher: Users, admin: Shield };
const PERSONA_LABELS = { student: 'Student', teacher: 'Teacher', admin: 'Administrator' };

export function TestModeBanner() {
  const { testMode, setTestPersona, resetTestData } = useSchool();
  const navigate = useNavigate();
  if (!testMode?.isTestSuperUser) return null;
  const active = testMode.activePersona || 'admin';

  const switchTo = async (persona) => {
    try {
      await setTestPersona(persona);
      navigate(createPageUrl(PERSONA_DASHBOARDS[persona]));
    } catch {
      toast.error('Failed to switch persona');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset BlockWard test data?\n\nThis deletes all test records, BlockWards and signatures in the test school. The test account and school are kept.')) return;
    try {
      await resetTestData();
      toast.success('Test data reset');
    } catch {
      toast.error('Reset failed');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-colors flex-shrink-0">
          <FlaskConical className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">TEST MODE · {PERSONA_LABELS[active]}</span>
          <span className="sm:hidden">{PERSONA_LABELS[active]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Viewing BlockWard as</DropdownMenuLabel>
        {['student', 'teacher', 'admin'].map((p) => {
          const PIcon = PERSONA_ICONS[p];
          return (
            <DropdownMenuItem key={p} onClick={() => switchTo(p)} className={cn(active === p && 'bg-primary/10')}>
              <PIcon className="h-4 w-4 mr-2" />
              {PERSONA_LABELS[p]}
              {active === p && <span className="ml-auto text-xs text-primary">●</span>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleReset} className="text-destructive">
          <RotateCcw className="h-4 w-4 mr-2" /> Reset Test Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TestModeMenuItems() {
  const { testMode, setTestPersona, resetTestData } = useSchool();
  const navigate = useNavigate();
  if (!testMode?.isTestSuperUser) return null;
  const active = testMode.activePersona || 'admin';

  const switchTo = async (persona) => {
    await setTestPersona(persona);
    navigate(createPageUrl(PERSONA_DASHBOARDS[persona]));
  };

  const handleReset = async () => {
    if (!window.confirm('Reset BlockWard test data?')) return;
    await resetTestData();
  };

  return (
    <>
      <DropdownMenuLabel className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5" /> TEST MODE
      </DropdownMenuLabel>
      <DropdownMenuLabel className="text-xs text-muted-foreground -mt-1 font-normal">
        Viewing as {PERSONA_LABELS[active]}
      </DropdownMenuLabel>
      {['student', 'teacher', 'admin'].map((p) => {
        const PIcon = PERSONA_ICONS[p];
        return (
          <DropdownMenuItem key={p} onClick={() => switchTo(p)} className={cn(active === p && 'bg-primary/10')}>
            <PIcon className="h-4 w-4 mr-2" /> Switch to {PERSONA_LABELS[p]}
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleReset} className="text-destructive">
        <RotateCcw className="h-4 w-4 mr-2" /> Reset Test Data
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}