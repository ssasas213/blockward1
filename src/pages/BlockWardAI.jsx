import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ScheduleTab from '@/components/ai/ScheduleTab';
import AnnouncementTab from '@/components/ai/AnnouncementTab';
import AIErrorBoundary from '@/components/ai/AIErrorBoundary';
import { Calendar, Megaphone, Sparkles } from 'lucide-react';

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
  ];

  return (
    <AIErrorBoundary>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">BlockWard AI</h1>
              <p className="text-sm text-slate-500">Your intelligent school assistant</p>
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
                  ? 'border-violet-500 bg-violet-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-violet-600' : 'text-slate-400'}`} />
                <span className={`font-semibold text-sm ${activeTab === tab.id ? 'text-violet-900' : 'text-slate-700'}`}>
                  {tab.label}
                </span>
              </div>
              <p className="text-xs text-slate-500">{tab.description}</p>
            </button>
          ))}
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <AIErrorBoundary key={activeTab}>
            {activeTab === 'schedule' && <ScheduleTab userType={userType} />}
            {activeTab === 'announcement' && (
              <AnnouncementTab
                userEmail={user?.email ?? null}
                userType={userType}
                schoolId={profile?.school_id ?? null}
              />
            )}
          </AIErrorBoundary>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Schedule answers are based only on events in your school's calendar. AI never invents events.
        </p>
      </div>
    </AIErrorBoundary>
  );
}