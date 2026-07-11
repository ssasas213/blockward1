import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getPlatformConfig } from '@/lib/platformConfig';
import { motion } from 'framer-motion';
import {
  Trophy, Shield, Award, Medal, Star, Users, TrendingUp,
  Calendar, BarChart3, Zap, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CATEGORY_ICONS = {
  'Belt Promotion': Trophy,
  'Tournament Winner': Medal,
  'Championship': Trophy,
  'Employee of the Month': Star,
  'Training Completion': CheckCircle2,
  'Professional Certification': Award,
  'Outstanding Service': Star,
  'Volunteer Award': Users,
  'Competition Winner': Medal,
};

export default function OrgDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [blockwards, setBlockwards] = useState([]);
  const [loading, setLoading] = useState(true);

  const platform = getPlatformConfig('organisations');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser) {
        const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
        if (profiles.length > 0) {
          setProfile(profiles[0]);
          // Load user's BlockWards
          try {
            const response = await base44.functions.invoke('getStudentVault', {
              student_email: currentUser.email,
            });
            setBlockwards(response?.data?.records || []);
          } catch {
            /* vault may be empty */
          }
        }
      }
    } catch {
      /* not authenticated */
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  const userType = profile?.user_type || 'student';
  const roleLabel = profile?.role_label || (userType === 'admin' ? 'Organisation Admin' : userType === 'teacher' ? 'Coach / Instructor' : 'Member / Athlete');
  const firstName = profile?.first_name || user?.email?.split('@')[0] || 'there';

  const totalAchievements = blockwards.length;
  const totalPoints = blockwards.reduce((sum, bw) => sum + (bw.points || 0), 0);
  const recentAchievements = blockwards.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 sm:p-8 text-white shadow-xl shadow-orange-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-5 w-5" />
          <span className="text-sm font-medium text-amber-100">{platform.name}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Welcome back, {firstName}!</h1>
        <p className="text-amber-50 text-sm">
          You are signed in as <span className="font-semibold">{roleLabel}</span>.
          {userType === 'student' && ' View your achievements and credentials below.'}
          {userType === 'teacher' && ' Manage your members and issue achievements.'}
          {userType === 'admin' && ' Manage your organisation and authorise achievements.'}
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Trophy}
          label="Total Achievements"
          value={totalAchievements}
          gradient="from-amber-500 to-orange-500"
        />
        <StatCard
          icon={Zap}
          label="Achievement Points"
          value={totalPoints}
          gradient="from-orange-500 to-red-500"
        />
        <StatCard
          icon={Shield}
          label="Verified Credentials"
          value={blockwards.filter(bw => bw.verify_id).length}
          gradient="from-rose-500 to-orange-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Achievement Categories */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5 text-orange-600" />
              {platform.credentialLabel} Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {platform.achievementCategories.map((category) => {
                const Icon = CATEGORY_ICONS[category] || Trophy;
                return (
                  <div key={category} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{category}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Achievements */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-orange-600" />
              Recent {platform.credentialLabel}s
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAchievements.length === 0 ? (
              <div className="py-8 text-center">
                <Trophy className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-500 mb-3">No {platform.credentialLabel.toLowerCase()}s yet</p>
                {userType === 'teacher' || userType === 'admin' ? (
                  <Link to="/organisations/issue">
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90">
                      Issue Achievement
                    </Button>
                  </Link>
                ) : (
                  <p className="text-xs text-slate-400">Your verified achievements will appear here.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {recentAchievements.map((bw) => (
                  <div key={bw.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                      <Trophy className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{bw.title}</p>
                      <p className="text-xs text-slate-500">{bw.category || 'Achievement'}</p>
                    </div>
                    {bw.verify_id && (
                      <Link to={`/verify/${bw.verify_id}`} target="_blank">
                        <Shield className="h-4 w-4 text-orange-600" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Info */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-amber-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">BlockWard Verification Engine</h3>
              <p className="text-sm text-slate-600 mb-3">
                Every achievement you earn is secured on the blockchain and verifiable through a public link.
                Your credentials are portable, permanent, and trusted.
              </p>
              <div className="flex flex-wrap gap-2">
                {platform.features.map((feature) => (
                  <span key={feature} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-amber-100 text-xs font-medium text-slate-700 shadow-sm">
                    <CheckCircle2 className="h-3 w-3 text-orange-500" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, gradient }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{isFinite(value) ? value : 0}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}