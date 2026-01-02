import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, BookOpen, Award, Shield, Calendar,
  Plus, ChevronRight, Clock, FileText
} from 'lucide-react';
import { motion } from 'framer-motion';

function TeacherDashboardContent() {
  const { user, profile: userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    myClasses: [],
    todaySchedule: [],
    recentPoints: [],
    totalStudents: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (!user) return;

      // Load teacher's classes
      const classes = await base44.entities.Class.filter({ teacher_email: user.email });
        
        // Get today's schedule
        const today = new Date().getDay();
        const dayIndex = today === 0 ? 6 : today - 1; // Convert Sunday=0 to Monday=0
        const schedule = await base44.entities.TimetableEntry.filter({ 
          teacher_email: user.email,
          day_of_week: dayIndex
        });

        // Get recent points issued by this teacher
        const points = await base44.entities.PointEntry.filter({ teacher_email: user.email }, '-created_date', 5);

        // Count total students
        let totalStudents = 0;
        classes.forEach(c => {
          totalStudents += (c.student_emails?.length || 0);
        });

        setStats({
          myClasses: classes,
          todaySchedule: schedule.sort((a, b) => a.start_time.localeCompare(b.start_time)),
          recentPoints: points,
          totalStudents
          });
          } catch (error) {
          console.error('Error loading dashboard:', error);
          } finally {
          setLoading(false);
          }
          };

  const statCards = [
    { title: 'My Classes', value: stats.myClasses.length, icon: BookOpen, color: 'from-violet-500 to-purple-500' },
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'from-blue-500 to-cyan-500' },
    { title: "Today's Lessons", value: stats.todaySchedule.length, icon: Calendar, color: 'from-emerald-500 to-green-500' },
    { title: 'Points Issued', value: stats.recentPoints.length, icon: Award, color: 'from-amber-500 to-orange-500' },
  ];

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
            Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {userProfile?.first_name}
          </h1>
          <p className="text-slate-500 mt-1">
            Here's your teaching overview
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to={createPageUrl('IssuePoints')}>
              <Award className="h-4 w-4 mr-2" />
              Issue Points
            </Link>
          </Button>
          {userProfile?.can_issue_blockwards && (
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700" asChild>
              <Link to={createPageUrl('TeacherBlockWards')}>
                <Shield className="h-4 w-4 mr-2" />
                Issue BlockWard
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{stat.title}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                    <stat.icon className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Today's Schedule</CardTitle>
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
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-900">{entry.start_time}</p>
                      <p className="text-xs text-slate-500">{entry.end_time}</p>
                    </div>
                    <div className={`h-12 w-1 rounded-full bg-gradient-to-b ${classColors[i % classColors.length]}`} />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{entry.class_name || entry.subject}</p>
                      <p className="text-sm text-slate-500">Room {entry.room}</p>
                    </div>
                    <Badge variant="outline">{entry.subject}</Badge>
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
              <div className="space-y-3">
                {stats.myClasses.slice(0, 4).map((cls, i) => (
                  <Link
                    key={cls.id}
                    to={createPageUrl(`ClassDetail?id=${cls.id}`)}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${classColors[i % classColors.length]} flex items-center justify-center`}>
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{cls.name}</p>
                      <p className="text-sm text-slate-500">
                        {cls.student_emails?.length || 0} students
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No classes yet</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link to={createPageUrl('Classes')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Class
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to={createPageUrl('Classes')}
              className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-xl hover:bg-violet-50 hover:text-violet-600 transition-colors"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">New Class</span>
            </Link>
            <Link
              to={createPageUrl('IssuePoints')}
              className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-xl hover:bg-violet-50 hover:text-violet-600 transition-colors"
            >
              <Award className="h-8 w-8" />
              <span className="text-sm font-medium">Issue Points</span>
            </Link>
            <Link
              to={createPageUrl('Resources')}
              className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-xl hover:bg-violet-50 hover:text-violet-600 transition-colors"
            >
              <FileText className="h-8 w-8" />
              <span className="text-sm font-medium">Upload Resource</span>
            </Link>
            {userProfile?.can_issue_blockwards && (
              <Link
                to={createPageUrl('TeacherBlockWards')}
                className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-xl hover:bg-violet-50 hover:text-violet-600 transition-colors"
              >
                <Shield className="h-8 w-8" />
                <span className="text-sm font-medium">BlockWard</span>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeacherDashboard() {
  return (
    <ProtectedRoute>
      <TeacherDashboardContent />
    </ProtectedRoute>
  );
}