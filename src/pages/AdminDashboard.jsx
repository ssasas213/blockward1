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
  Users, BookOpen, Award, Shield, TrendingUp, 
  ArrowUpRight, Plus, ChevronRight, Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';

function AdminDashboardContent() {
  const { profile: userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalBlockWards: 0,
    recentPoints: [],
    recentBlockWards: [],
    pointsByCategory: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (userProfile?.school_id) {
        const schools = await base44.entities.School.filter({ id: userProfile.school_id });
        if (schools.length > 0) setSchool(schools[0]);
      }

        // Load all stats
        const [students, teachers, classes, blockWards, points] = await Promise.all([
          base44.entities.UserProfile.filter({ user_type: 'student' }),
          base44.entities.UserProfile.filter({ user_type: 'teacher' }),
          base44.entities.Class.list(),
          base44.entities.BlockWard.list('-created_date', 10),
          base44.entities.PointEntry.list('-created_date', 20)
        ]);

        // Calculate points by category
        const categoryTotals = {};
        points.forEach(p => {
          const key = p.category_name || 'Other';
          if (!categoryTotals[key]) categoryTotals[key] = { name: key, value: 0, type: p.type };
          categoryTotals[key].value += Math.abs(p.points);
        });

        setStats({
          totalStudents: students.length,
          totalTeachers: teachers.length,
          totalClasses: classes.length,
          totalBlockWards: blockWards.length,
          recentPoints: points.slice(0, 5),
          recentBlockWards: blockWards.slice(0, 5),
          pointsByCategory: Object.values(categoryTotals)
          });
          } catch (error) {
          console.error('Error loading dashboard:', error);
          } finally {
          setLoading(false);
          }
          };

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50' },
    { title: 'Total Teachers', value: stats.totalTeachers, icon: Users, color: 'from-violet-500 to-purple-500', bg: 'bg-violet-50' },
    { title: 'Active Classes', value: stats.totalClasses, icon: BookOpen, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-50' },
    { title: 'BlockWards Issued', value: stats.totalBlockWards, icon: Shield, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
  ];

  const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

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
            Welcome back, {userProfile?.first_name}
          </h1>
          <p className="text-slate-500 mt-1">
            {school?.name || 'Admin Dashboard'} Overview
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to={createPageUrl('ManageUsers')}>
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={createPageUrl('BlockchainDocs')}>
              <Shield className="h-4 w-4 mr-2" />
              Blockchain Docs
            </Link>
          </Button>
          <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700" asChild>
            <Link to={createPageUrl('BlockWards')}>
              <Shield className="h-4 w-4 mr-2" />
              View BlockWards
            </Link>
          </Button>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points Distribution */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Points Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pointsByCategory.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.pointsByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.pointsByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No point data yet
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {stats.pointsByCategory.map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-slate-600">{cat.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <Activity className="h-5 w-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentPoints.length > 0 ? (
                stats.recentPoints.map((point, i) => (
                  <div key={point.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        point.type === 'achievement' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{point.student_name}</p>
                        <p className="text-sm text-slate-500">{point.reason}</p>
                      </div>
                    </div>
                    <Badge variant={point.type === 'achievement' ? 'default' : 'destructive'}>
                      {point.points > 0 ? '+' : ''}{point.points}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent BlockWards */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent BlockWards</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={createPageUrl('BlockWards')}>
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {stats.recentBlockWards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.recentBlockWards.slice(0, 3).map((bw) => (
                <div key={bw.id} className="p-4 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl text-white">
                  <div className="flex items-center justify-between mb-3">
                    <Shield className="h-6 w-6" />
                    <Badge className="bg-white/20 text-white border-0">
                      {bw.category}
                    </Badge>
                  </div>
                  <h3 className="font-bold mb-1">{bw.title}</h3>
                  <p className="text-white/80 text-sm">Awarded to {bw.student_name}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No BlockWards issued yet</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link to={createPageUrl('BlockWards')}>
                  Issue First BlockWard
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}