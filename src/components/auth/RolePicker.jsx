import React from 'react';
import { Shield, GraduationCap, Users } from 'lucide-react';

export const ROLES = [
  { key: 'student', icon: GraduationCap, title: 'Student', description: 'Earn and track your achievements' },
  { key: 'teacher', icon: Users, title: 'Teacher', description: 'Verify and issue achievements' },
  { key: 'admin', icon: Shield, title: 'School Administrator', description: 'Manage school and approve records' },
];

export default function RolePicker({ selectedRole, onSelect }) {
  return (
    <div className="space-y-2">
      {ROLES.map((role) => {
        const isSelected = selectedRole === role.key;
        return (
          <button
            key={role.key}
            type="button"
            onClick={() => onSelect(role.key)}
            className={`flex items-center gap-4 w-full p-3 rounded-xl border-2 cursor-pointer transition-all text-left ${
              isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            }`}
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              <role.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">{role.title}</p>
              <p className="text-xs text-muted-foreground">{role.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}