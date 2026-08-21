import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ScheduleTab from '@/components/ai/ScheduleTab.jsx';
import AnnouncementTab from '@/components/ai/AnnouncementTab';
import SchoolReportTab from '@/components/ai/SchoolReportTab';
import AIErrorBoundary from '@/components/ai/AIErrorBoundary';
import { Calendar, Megaphone, Sparkles, BarChart3 } from 'lucide-react';

export default function BlockWardAI() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    base44.auth.me()
      .then(async u => {
        setUser(u ?? null);
        if (u) {
          const profiles = await base44.entities.UserProfile.filter({ user_email: u.email });
          setProfile(profiles[0] || null);
        }
      })
      .catch(() => {});
  }, []);

  const userType = profile?.user_type || 'teacher';

  const tabs = [
    { id: 'schedule', label: 'Ask Schedule', icon: Calendar, description: 'Query school events & assemblies' },
    { id: 'announcement', label: 'Draft Announcement', icon: Megaphone, description: 'AI-powered class communication' },
    ...(userType === 'admin' ? [{ id: 'report', label: 'School Report', icon: BarChart3, description: 'AI analyses whole school → downloadable report' }] : []),
  ];

  return (
    <AIErrorBoundary>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">BlockWard AI</h1>
              <p className="text-sm text-muted-foreground">Your intelligent school assistant</p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                activeTab === tab.id
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-hover/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`font-semibold text-sm ${activeTab === tab.id ? 'text-primary' : 'text-foreground'}`}>
                  {tab.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{tab.description}</p>
            </button>
          ))}
        </div>

        {/* Content card */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-6">
          <AIErrorBoundary key={activeTab}>
            {activeTab === 'schedule' && <ScheduleTab userType={userType} />}
            {activeTab === 'announcement' && (
              <AnnouncementTab
                userEmail={user?.email ?? null}
                userType={userType}
                schoolId={profile?.school_id ?? null}
              />
            )}
            {activeTab === 'report' && (
              <SchoolReportTab userType={userType} schoolId={profile?.school_id ?? null} />
            )}
          </AIErrorBoundary>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Schedule answers are based only on events in your school's calendar. AI never invents events.
        </p>
      </div>
    </AIErrorBoundary>
  );
}