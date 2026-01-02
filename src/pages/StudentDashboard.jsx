import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Award, Shield, Calendar, BookOpen, 
  ChevronRight, TrendingUp, Star, Clock, FileText
} from 'lucide-react';
import { motion } from 'framer-motion';

function StudentDashboardContent() {
  const { user, profile: userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    myClasses: [],
    todaySchedule: [],
    recentPoints: [],
    blockWards: [],
    achievementPoints: 0,
    behaviourPoints: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (!user) return;

        // Get classes where student is enrolled
        const allClasses = await base44.entities.Class.list();
        const myClasses = allClasses.filter(c => 
          c.student_emails?.includes(user.email)
        );

        // Get today's schedule based on enrolled classes
        const today = new Date().getDay();
        const dayIndex = today === 0 ? 6 : today - 1;
        const classIds = myClasses.map(c => c.id);
        const allSchedules = await base44.entities.TimetableEntry.filter({ day_of_week: dayIndex });
        const todaySchedule = allSchedules.filter(s => classIds.includes(s.class_id));

        // Get points and BlockWards
        const [points, blockWards] = await Promise.all([
          base44.entities.PointEntry.filter({ student_email: user.email }, '-created_date', 10),
          base44.entities.BlockWard.filter({ student_email: user.email, status: 'active' })
        ]);

        // Calculate totals
        let achievementPoints = 0;
        let behaviourPoints = 0;
        points.forEach(p => {
          if (p.type === 'achievement') achievementPoints += p.points;
          else behaviourPoints += Math.abs(p.points);
        });

      setStats({
        myClasses,
        todaySchedule: todaySchedule.sort((a, b) => a.start_time.localeCompare(b.start_time)),
        recentPoints: points.slice(0, 5),
        blockWards,
        achievementPoints: userProfile?.total_achievement_points || achievementPoints,
        behaviourPoints: userProfile?.total_behaviour_points || behaviourPoints
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const classColors = [
    'from-violet-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-green-500',
    'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome, {userProfile?.first_name}!
          </h1>
          <p className="text-slate-500 mt-1">
            {userProfile?.grade_level && `${userProfile.grade_level} • `}Student Dashboard
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to={createPageUrl('Timetable')}>
              <Calendar className="h-4 w-4 mr-2" />
              My Timetable
            </Link>
          </Button>
          <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700" asChild>
            <Link to={createPageUrl('StudentBlockWards')}>
              <Shield className="h-4 w-4 mr-2" />
              My BlockWards
            </Link>
          </Button>
        </div>
      </div>

      {/* Points Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100">Achievement Points</p>
                  <p className="text-4xl font-bold mt-1">{stats.achievementPoints}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100">Behaviour Points</p>
                  <p className="text-4xl font-bold mt-1">{stats.behaviourPoints}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Award className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-violet-100">BlockWards Earned</p>
                  <p className="text-4xl font-bold mt-1">{stats.blockWards.length}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Shield className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Today's Classes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={createPageUrl('Timetable')}>
                View Full
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.todaySchedule.length > 0 ? (
              <div className="space-y-3">
                {stats.todaySchedule.map((entry, i) => (
                  <div key={entry.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="text-center min-w-[60px]">
                      <p className="text-sm font-medium text-slate-900">{entry.start_time}</p>
                      <p className="text-xs text-slate-500">{entry.end_time}</p>
                    </div>
                    <div className={`h-12 w-1 rounded-full bg-gradient-to-b ${classColors[i % classColors.length]}`} />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{entry.class_name || entry.subject}</p>
                      <p className="text-sm text-slate-500">Room {entry.room}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No classes scheduled today</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Points */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Points</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={createPageUrl('MyPoints')}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentPoints.length > 0 ? (
              <div className="space-y-3">
                {stats.recentPoints.map((point) => (
                  <div key={point.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        point.type === 'achievement' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {point.type === 'achievement' ? <Star className="h-5 w-5" /> : <Award className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{point.category_name || point.reason}</p>
                        <p className="text-sm text-slate-500">{point.reason}</p>
                      </div>
                    </div>
                    <Badge variant={point.type === 'achievement' ? 'default' : 'destructive'}>
                      {point.points > 0 ? '+' : ''}{point.points}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No points recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Classes */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">My Classes</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={createPageUrl('Classes')}>
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {stats.myClasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.myClasses.map((cls, i) => (
                <Link
                  key={cls.id}
                  to={createPageUrl(`ClassDetail?id=${cls.id}`)}
                  className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${classColors[i % classColors.length]} flex items-center justify-center`}>
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{cls.name}</p>
                      <p className="text-sm text-slate-500">{cls.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Room {cls.room || 'TBA'}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Not enrolled in any classes yet</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link to={createPageUrl('Classes')}>
                  Join a Class
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BlockWards Showcase */}
      {stats.blockWards.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">My BlockWards</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={createPageUrl('BlockWards')}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.blockWards.slice(0, 3).map((bw) => (
                <div key={bw.id} className="p-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl text-white">
                  <div className="flex items-center justify-between mb-4">
                    <Shield className="h-8 w-8" />
                    <Badge className="bg-white/20 text-white border-0">
                      Verified
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{bw.title}</h3>
                  <p className="text-white/80 text-sm mb-3">{bw.description}</p>
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>Issued by {bw.issuer_name}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <ProtectedRoute>
      <StudentDashboardContent />
    </ProtectedRoute>
  );
}