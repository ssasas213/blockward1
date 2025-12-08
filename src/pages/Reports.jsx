import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart3, Users, Shield, TrendingUp, TrendingDown, 
  Award, Download, Calendar
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { motion } from 'framer-motion';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [stats, setStats] = useState({
    totalPoints: [],
    pointsByCategory: [],
    pointsByClass: [],
    topStudents: [],
    blockWardsByCategory: [],
    dailyActivity: []
  });

  useEffect(() => {
    loadReportData();
  }, [timeRange]);

  const loadReportData = async () => {
    try {
      const [points, blockWards, students, classes] = await Promise.all([
        base44.entities.PointEntry.list('-created_date'),
        base44.entities.BlockWard.list('-created_date'),
        base44.entities.UserProfile.filter({ user_type: 'student' }),
        base44.entities.Class.list()
      ]);

      // Filter by time range
      const now = new Date();
      let startDate;
      switch (timeRange) {
        case 'week': startDate = subDays(now, 7); break;
        case 'month': startDate = subDays(now, 30); break;
        case 'year': startDate = subDays(now, 365); break;
        default: startDate = subDays(now, 7);
      }

      const filteredPoints = points.filter(p => 
        new Date(p.created_date) >= startDate
      );
      const filteredBlockWards = blockWards.filter(bw => 
        new Date(bw.created_date) >= startDate
      );

      // Points by category
      const categoryTotals = {};
      filteredPoints.forEach(p => {
        const cat = p.category_name || 'Other';
        if (!categoryTotals[cat]) categoryTotals[cat] = { name: cat, achievement: 0, behaviour: 0 };
        if (p.type === 'achievement') categoryTotals[cat].achievement += p.points;
        else categoryTotals[cat].behaviour += Math.abs(p.points);
      });

      // Points by class
      const classTotals = {};
      filteredPoints.forEach(p => {
        const cls = p.class_name || 'Unknown';
        if (!classTotals[cls]) classTotals[cls] = { name: cls, total: 0 };
        classTotals[cls].total += p.points;
      });

      // Top students
      const studentTotals = {};
      filteredPoints.forEach(p => {
        if (!studentTotals[p.student_email]) {
          studentTotals[p.student_email] = { 
            name: p.student_name, 
            email: p.student_email,
            achievement: 0, 
            behaviour: 0 
          };
        }
        if (p.type === 'achievement') studentTotals[p.student_email].achievement += p.points;
        else studentTotals[p.student_email].behaviour += Math.abs(p.points);
      });

      // BlockWards by category
      const bwCategories = {};
      filteredBlockWards.forEach(bw => {
        const cat = bw.category || 'other';
        if (!bwCategories[cat]) bwCategories[cat] = { name: cat, count: 0 };
        bwCategories[cat].count++;
      });

      // Daily activity
      const dailyData = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(now, i), 'MMM d');
        dailyData[date] = { date, points: 0, blockWards: 0 };
      }
      filteredPoints.forEach(p => {
        const date = format(new Date(p.created_date), 'MMM d');
        if (dailyData[date]) dailyData[date].points += Math.abs(p.points);
      });
      filteredBlockWards.forEach(bw => {
        const date = format(new Date(bw.created_date), 'MMM d');
        if (dailyData[date]) dailyData[date].blockWards++;
      });

      setStats({
        totalPoints: filteredPoints.length,
        totalBlockWards: filteredBlockWards.length,
        totalAchievementPoints: filteredPoints.filter(p => p.type === 'achievement').reduce((sum, p) => sum + p.points, 0),
        totalBehaviourPoints: filteredPoints.filter(p => p.type === 'behaviour').reduce((sum, p) => sum + Math.abs(p.points), 0),
        pointsByCategory: Object.values(categoryTotals),
        pointsByClass: Object.values(classTotals).sort((a, b) => b.total - a.total).slice(0, 5),
        topStudents: Object.values(studentTotals).sort((a, b) => b.achievement - a.achievement).slice(0, 10),
        blockWardsByCategory: Object.values(bwCategories),
        dailyActivity: Object.values(dailyData)
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

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
          <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">View school performance insights</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-violet-100">Total Points Issued</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalPoints}</p>
                </div>
                <Award className="h-10 w-10 text-white/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100">Achievement Points</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalAchievementPoints}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-white/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100">Behaviour Points</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalBehaviourPoints}</p>
                </div>
                <TrendingDown className="h-10 w-10 text-white/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">BlockWards Minted</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalBlockWards}</p>
                </div>
                <Shield className="h-10 w-10 text-white/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="points" stroke="#8B5CF6" strokeWidth={2} name="Points" />
                  <Line type="monotone" dataKey="blockWards" stroke="#3B82F6" strokeWidth={2} name="BlockWards" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Points by Category */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Points by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.pointsByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="achievement" fill="#10B981" name="Achievement" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="behaviour" fill="#EF4444" name="Behaviour" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BlockWards by Category */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">BlockWards by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.blockWardsByCategory.length > 0 ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.blockWardsByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {stats.blockWardsByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {stats.blockWardsByCategory.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-slate-600 capitalize">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No BlockWard data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Students */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Top Students by Achievement</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topStudents.length > 0 ? (
              <div className="space-y-3">
                {stats.topStudents.slice(0, 5).map((student, i) => (
                  <div key={student.email} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-slate-200 text-slate-700' :
                        i === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{student.name}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge className="bg-green-100 text-green-700 text-xs">+{student.achievement}</Badge>
                          <Badge variant="outline" className="text-red-600 text-xs">-{student.behaviour}</Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-slate-900">
                      {student.achievement - student.behaviour}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No student data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}