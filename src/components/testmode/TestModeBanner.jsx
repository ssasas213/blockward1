import React, { useEffect, useState } from 'react';
import { FlaskConical, GraduationCap, Users, Shield, RotateCcw, Sprout, Trash2, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useSchool } from '@/lib/SchoolContext';
import TestFlowIndicator from '@/components/testmode/TestFlowIndicator';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isScreenshotMode, setScreenshotMode, onScreenshotModeChange } from '@/lib/screenshotMode';

const PERSONA_DASHBOARDS = {
  student: 'StudentDashboard', demo_student: 'StudentDashboard',
  teacher: 'TeacherDashboard', demo_teacher: 'TeacherDashboard',
  admin: 'AdminDashboard', demo_admin: 'AdminDashboard',
};
const PERSONA_ICONS = {
  student: GraduationCap, teacher: Users, admin: Shield,
  demo_student: GraduationCap, demo_teacher: Users, demo_admin: Shield,
};
const PERSONA_LABELS = {
  student: 'Student', teacher: 'Teacher', admin: 'Administrator',
  demo_student: 'Demo Student', demo_teacher: 'Demo Teacher', demo_admin: 'Demo Admin',
};
const DEMO_KEYS = ['demo_student', 'demo_teacher', 'demo_admin'];

// ── Screenshot mode (visual only — hides the TEST MODE banner) ──
function useScreenshotMode() {
  const [on, setOn] = useState(isScreenshotMode());
  useEffect(() => onScreenshotModeChange(() => setOn(isScreenshotMode())), []);
  return [on, (value) => setScreenshotMode(value)];
}

function ScreenshotToggleItem() {
  const [shotOn, setShot] = useScreenshotMode();
  return (
    <DropdownMenuItem onClick={() => setShot(!shotOn)}>
      <Camera className="h-4 w-4 mr-2" />
      Screenshot mode
      {shotOn && <span className="ml-auto text-xs text-primary font-semibold">✓</span>}
    </DropdownMenuItem>
  );
}

// ── Demo world personas (resolved server-side from the demo-run manifest) ──
function DemoPersonaItems({ personas, active, onSwitch }) {
  const available = DEMO_KEYS.filter((p) => personas?.[p]?.id);
  if (available.length === 0) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs text-muted-foreground">Demo world (screenshots)</DropdownMenuLabel>
      {available.map((p) => {
        const PIcon = PERSONA_ICONS[p];
        return (
          <DropdownMenuItem key={p} onClick={() => onSwitch(p)} className={cn(active === p && 'bg-primary/10')}>
            <PIcon className="h-4 w-4 mr-2" />
            {personas[p]?.name || PERSONA_LABELS[p]}
            {active === p && <span className="ml-auto text-xs text-primary">●</span>}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

export function TestModeBanner() {
  const { testMode, setTestPersona, resetTestData } = useSchool();
  const navigate = useNavigate();
  const [shotOn] = useScreenshotMode();
  if (!testMode?.isTestSuperUser || shotOn) return null;
  const active = testMode.activePersona || 'admin';

  const switchTo = async (persona) => {
    try {
      await setTestPersona(persona);
      navigate(createPageUrl(PERSONA_DASHBOARDS[persona]));
    } catch {
      toast.error('Failed to switch persona');
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('Seed a complete demo organisation?\n\nOne admin, two pending teachers, twenty students, a class, timetable, attendance and achievements — removable in one action.')) return;
    try {
      const res = await base44.functions.invoke('seedDemoOrganisation', { action: 'seed' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Seed failed');
      toast.success(`Demo organisation "${res.data.school?.name || ''}" created`);
    } catch (e) {
      toast.error(e?.message || 'Seed failed');
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove the demo organisation and all its records?')) return;
    try {
      const res = await base44.functions.invoke('seedDemoOrganisation', { action: 'remove' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Removal failed');
      toast.success('Demo organisation removed');
    } catch (e) {
      toast.error(e?.message || 'Removal failed');
    }
  };

  const handleResetAll = async () => {
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
          <span className="hidden sm:inline">TEST MODE · {PERSONA_LABELS[active] || active}</span>
          <span className="sm:hidden">{PERSONA_LABELS[active] || active}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Acting as</DropdownMenuLabel>
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
        <DemoPersonaItems personas={testMode.personas} active={active} onSwitch={switchTo} />
        <DropdownMenuSeparator />
        <TestFlowIndicator />
        <DropdownMenuSeparator />
        <ScreenshotToggleItem />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSeed}>
          <Sprout className="h-4 w-4 mr-2" /> Seed Demo Organisation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleRemove}>
          <Trash2 className="h-4 w-4 mr-2" /> Remove Demo Data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleResetAll} className="text-destructive">
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
    try {
      await setTestPersona(persona);
      navigate(createPageUrl(PERSONA_DASHBOARDS[persona]));
    } catch {
      toast.error('Failed to switch persona');
    }
  };

  const handleSeedDemo = async () => {
    if (!window.confirm('Seed a complete demo organisation?\n\nOne admin, two pending teachers, twenty students, a class, timetable, attendance and achievements — removable in one action.')) return;
    try {
      const res = await base44.functions.invoke('seedDemoOrganisation', { action: 'seed' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Seed failed');
      toast.success(`Demo organisation "${res.data.school?.name || ''}" created`);
    } catch (e) {
      toast.error(e?.message || 'Seed failed');
    }
  };

  const handleRemoveDemo = async () => {
    if (!window.confirm('Remove the demo organisation and all its records?')) return;
    try {
      const res = await base44.functions.invoke('seedDemoOrganisation', { action: 'remove' });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Removal failed');
      toast.success('Demo organisation removed');
    } catch (e) {
      toast.error(e?.message || 'Removal failed');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset BlockWard test data?')) return;
    try {
      await resetTestData();
    } catch {
      toast.error('Reset failed');
    }
  };

  return (
    <>
      <DropdownMenuLabel className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5" /> TEST MODE
      </DropdownMenuLabel>
      <DropdownMenuLabel className="text-xs text-muted-foreground -mt-1 font-normal">
        Acting as {PERSONA_LABELS[active] || active}
      </DropdownMenuLabel>
      {['student', 'teacher', 'admin'].map((p) => {
        const PIcon = PERSONA_ICONS[p];
        return (
          <DropdownMenuItem key={p} onClick={() => switchTo(p)} className={cn(active === p && 'bg-primary/10')}>
            <PIcon className="h-4 w-4 mr-2" /> Switch to {PERSONA_LABELS[p]}
          </DropdownMenuItem>
        );
      })}
      <DemoPersonaItems personas={testMode.personas} active={active} onSwitch={switchTo} />
      <DropdownMenuSeparator />
      <TestFlowIndicator />
      <DropdownMenuSeparator />
      <ScreenshotToggleItem />
      <DropdownMenuItem onClick={handleSeedDemo}>
        <Sprout className="h-4 w-4 mr-2" /> Seed Demo Organisation
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleRemoveDemo}>
        <Trash2 className="h-4 w-4 mr-2" /> Remove Demo Data
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleReset} className="text-destructive">
        <RotateCcw className="h-4 w-4 mr-2" /> Reset Test Data
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}