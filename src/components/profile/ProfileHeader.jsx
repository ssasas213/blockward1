import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, School, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const ROLE_GRADIENT = {
  admin: 'from-rose-500 to-orange-500',
  teacher: 'from-violet-500 to-purple-500',
  student: 'from-blue-500 to-cyan-500',
};

const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };

const STATUS_CONFIG = {
  active: { label: 'Active', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  suspended: { label: 'Suspended', icon: AlertCircle, cls: 'bg-red-100 text-red-700 border-red-200' },
  inactive: { label: 'Inactive', icon: Clock, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function ProfileHeader({ profile, user, school }) {
  const grad = ROLE_GRADIENT[profile?.user_type] || 'from-slate-400 to-slate-500';
  const statusCfg = STATUS_CONFIG[profile?.status] || STATUS_CONFIG.active;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white">
      <div className={`h-28 bg-gradient-to-r ${grad}`} />
      <div className="px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-14 mb-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="avatar"
              className="h-24 w-24 rounded-2xl object-cover shadow-xl border-4 border-white flex-shrink-0"
            />
          ) : (
            <div className={`h-24 w-24 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-xl border-4 border-white flex-shrink-0 bg-gradient-to-br ${grad}`}>
              {(profile?.first_name?.[0] || '?').toUpperCase()}
            </div>
          )}
          <div className="flex-1 pb-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {profile?.first_name} {profile?.last_name}
            </h2>
            <p className="text-slate-500 text-sm">{user?.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={`border ${ROLE_GRADIENT[profile?.user_type] ? 'bg-violet-100 text-violet-700 border-violet-200' : ''}`}>
                <Shield className="h-3 w-3 mr-1" />
                {ROLE_LABEL[profile?.user_type] || profile?.user_type}
              </Badge>
              <Badge className={`border ${statusCfg.cls}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusCfg.label}
              </Badge>
              {school && (
                <Badge variant="outline">
                  <School className="h-3 w-3 mr-1" />
                  {school.name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 pt-4 border-t border-slate-100">
          {[
            { label: 'School ID', value: profile?.school_id ? profile.school_id.slice(-8).toUpperCase() : '—' },
            { label: profile?.user_type === 'student' ? 'Student ID' : profile?.user_type === 'teacher' ? 'Teacher ID' : 'Admin Level', value: profile?.student_id || profile?.admin_level || '—' },
            { label: 'Joined', value: profile?.created_date ? format(new Date(profile.created_date), 'MMM yyyy') : '—' },
            { label: 'Status', value: statusCfg.label },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5 truncate">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}