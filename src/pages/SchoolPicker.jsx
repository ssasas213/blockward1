import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, Loader2, Building2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSchool } from '@/lib/SchoolContext';

// Shown at login when a user belongs to more than one school — they pick
// instead of the app silently defaulting. The switch is authorized and applied
// server-side (switchActiveSchool), then the user is routed to the dashboard
// for their role.
const DASHBOARDS = {
  admin: '/AdminDashboard',
  teacher: '/TeacherDashboard',
  student: '/StudentDashboard',
};

export default function SchoolPicker() {
  // Session identity from context — routing falls back to the profile's role.
  const { profile } = useSchool();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState([]);
  const [role, setRole] = useState(null);
  const [switching, setSwitching] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('loginSchoolOptions');
        const list = res.data?.schools || [];
        setSchools(list);
        setRole(res.data?.role || null);
        if (list.length <= 1) {
          // Nothing to pick — go straight to the dashboard. A student with no
          // organisation has an empty school list and must still reach their
          // dashboard: route by the response role, then the profile's
          // user_type, then default to StudentDashboard. JoinSchool is NEVER
          // a fallback destination for anyone.
          window.location.href =
            DASHBOARDS[res.data?.role] ||
            DASHBOARDS[profile?.user_type] ||
            '/StudentDashboard';
        }
      } catch {
        setError('Could not load your schools. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const finish = (school) => {
    window.location.href = (school.org_type && school.org_type !== 'school')
      ? '/organisations/dashboard'
      : (DASHBOARDS[role] || '/StudentDashboard');
  };

  const choose = async (school) => {
    if (school.is_current) {
      finish(school);
      return;
    }
    setSwitching(school.id);
    setError('');
    try {
      const res = await base44.functions.invoke('switchActiveSchool', { school_id: school.id });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Could not switch school');
      finish(school);
    } catch (e) {
      setError(e.message || 'Could not switch school. Please try again.');
      setSwitching(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 accent-glow">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground tracking-tight">BlockWard</span>
          </Link>
        </div>

        <div className="glass rounded-xl shadow-sm p-8">
          <h1 className="text-xl font-semibold text-foreground mb-1 text-center">Choose your school</h1>
          <p className="text-sm text-muted-foreground mb-6 text-center">
            You belong to more than one school. Which one are you working with today?
          </p>

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive mb-4">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {schools.map((school) => (
                <button
                  key={school.id}
                  onClick={() => choose(school)}
                  disabled={switching !== null}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-hover transition-colors text-left disabled:opacity-60"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {school.logo_url ? (
                      <img src={school.logo_url} alt="" className="h-10 w-10 object-cover" />
                    ) : (
                      <Building2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{school.name}</p>
                    {(school.city || school.country) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[school.city, school.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  {switching === school.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                  ) : school.is_current ? (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-primary font-medium">
                      <Check className="h-3.5 w-3.5" /> Current
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can switch schools anytime from the sidebar.
        </p>
      </div>
    </div>
  );
}