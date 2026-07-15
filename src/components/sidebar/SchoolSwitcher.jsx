import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSchool } from '@/lib/SchoolContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Shield, Check, ChevronDown, Plus, LogIn, Settings, Building2, Loader2 } from 'lucide-react';

export default function SchoolSwitcher({ onClose }) {
  const { activeSchool, managedSchools, loading, isAdmin, switchSchool } = useSchool();
  const [switching, setSwitching] = useState(null);
  const navigate = useNavigate();

  const goTo = (path) => {
    if (onClose) onClose();
    navigate(path);
  };

  if (!isAdmin) {
    // Teachers and students — show school name, clickable to Profile
    const goToProfile = () => {
      if (onClose) onClose();
      navigate(createPageUrl('Profile'));
    };
    return (
      <button onClick={goToProfile} className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
        <p className="font-semibold text-foreground text-sm leading-tight">BlockWard</p>
        {loading ? (
          <p className="text-xs text-muted-foreground truncate leading-tight">Loading school…</p>
        ) : activeSchool ? (
          <p className="text-xs text-primary/80 truncate leading-tight">{activeSchool.name}</p>
        ) : (
          <p className="text-xs text-warning truncate leading-tight">No school linked — click to join</p>
        )}
      </button>
    );
  }

  const handleSwitch = async (schoolId) => {
    if (schoolId === (activeSchool?.id)) return;
    setSwitching(schoolId);
    await switchSchool(schoolId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2.5 hover:opacity-80 transition-opacity text-left">
          <Shield className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight">BlockWard</p>
            {loading ? (
              <p className="text-xs text-muted-foreground truncate leading-tight">Loading school…</p>
            ) : activeSchool ? (
              <p className="text-xs text-muted-foreground truncate leading-tight flex items-center gap-1">
                {activeSchool.name}
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              </p>
            ) : (
              <p className="text-xs text-muted-foreground truncate leading-tight flex items-center gap-1">
                Choose or create a school
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              </p>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Your Schools
        </DropdownMenuLabel>

        {loading ? (
          <div className="py-4 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : managedSchools.length === 0 ? (
          <div className="px-2 py-3">
            <p className="text-xs text-muted-foreground">No schools linked yet.</p>
          </div>
        ) : (
          managedSchools.map((school) => {
            const isActive = activeSchool?.id === school.id;
            return (
              <DropdownMenuItem
                key={school.id}
                onClick={() => handleSwitch(school.id)}
                className="cursor-pointer flex items-center gap-2"
                disabled={switching !== null}
              >
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {school.logo_url ? (
                    <img src={school.logo_url} alt="" className="h-7 w-7 rounded-md object-cover" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <span className={cn('flex-1 text-sm truncate', isActive && 'text-primary font-medium')}>
                  {school.name}
                </span>
                {isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                {switching === school.id && <Loader2 className="h-3 w-3 animate-spin" />}
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => goTo(createPageUrl('SchoolSetup'))}
          className="cursor-pointer flex items-center gap-2"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Create New School</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => goTo(createPageUrl('SchoolSetup') + '?mode=join')}
          className="cursor-pointer flex items-center gap-2"
        >
          <LogIn className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Join School</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => goTo(createPageUrl('SystemSettings'))}
          className="cursor-pointer flex items-center gap-2"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">School Settings</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}