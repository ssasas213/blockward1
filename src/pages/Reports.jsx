import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import EmptyState from '@/components/ui/empty-state';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import {
  Award, Shield, TrendingUp, TrendingDown, Calendar
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays } from 'date-fns';

const TOOLTIP_STYLE = {
  background: 'hsl(252 21% 10%)',
  border: '1px solid hsl(0 0% 100% / 0.1)',
  borderRadius: '0.5rem',
  color: 'hsl(0 0% 95%)',
};
const AXIS_TICK = { fontSize: 12, fill: 'hsl(240 8% 62%)' };
const GRID_STROKE = 'hsl(0 0% 100% / 0.08)';
const CHART_COLORS = [
  'hsl(258 90% 66%)', 'hsl(330 81% 60%)', 'hsl(239 84% 67%)',
  'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(280 60% 55%)',
];

import RoleGuard from '@/components/auth/RoleGuard';
export default function Reports() { return <RoleGuard roles={['admin']}><ReportsImpl/></RoleGuard>; }
function ReportsImpl() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [stats, setStats] = useState({
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

      const now = new Date();
      let startDate;
      switch (timeRange) {
        case 'week': startDate = subDays(now, 7); break;
        case 'month': startDate = subDays(now, 30); break;
        case 'year': startDate = subDays(now, 365); break;
        default: startDate = subDays(now, 7);
      }

      const filteredPoints = points.filter(p => new Date(p.created_date) >= startDate);
      const filteredBlockWards = blockWards.filter(bw => new Date(bw.created_date) >= startDate);

      const categoryTotals = {};
      filteredPoints.forEach(p => {
        const cat = p.category_name || 'Other';
        if (!categoryTotals[cat]) categoryTotals[cat] = { name: cat, achievement: 0, behaviour: 0 };
        if (p.type === 'achievement') categoryTotals[cat].achievement += p.points;
        else categoryTotals[cat].behaviour += Math.abs(p.points);
      });

      const classTotals = {};
      filteredPoints.forEach(p => {
        const cls = p.class_name || 'Unknown';
        if (!classTotals[cls]) classTotals[cls] = { name: cls, total: 0 };
        classTotals[cls].total += p.points;
      });

      const studentTotals = {};
      filteredPoints.forEach(p => {
        if (!studentTotals[p.student_email]) {
          studentTotals[p.student_email] = { name: p.student_name, email: p.student_email, achievement: 0, behaviour: 0 };
        }
        if (p.type === 'achievement') studentTotals[p.student_email].achievement += p.points;
        else studentTotals[p.student_email].behaviour += Math.abs(p.points);
      });

      const bwCategories = {};
      filteredBlockWards.forEach(bw => {
        const cat = bw.category || 'other';
        if (!bwCategories[cat]) bwCategories[cat] = { name: cat, count: 0 };
        bwCategories[cat].count++;
      });

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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports & Analytics" description="View school performance insights" />
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="View school performance insights">
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
      </PageHeader>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Points Issued" value={stats.totalPoints} icon={Award} accentColor="primary" />
        <StatCard label="Achievement Points" value={stats.totalAchievementPoints} icon={TrendingUp} accentColor="success" />
        <StatCard label="Behaviour Points" value={stats.totalBehaviourPoints} icon={TrendingDown} accentColor="warning" />
        <StatCard label="BlockWards Minted" value={stats.totalBlockWards} icon={Shield} accentColor="blue" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="date" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="points" stroke="hsl(258 90% 66%)" strokeWidth={2} name="Points" />
                  <Line type="monotone" dataKey="blockWards" stroke="hsl(239 84% 67%)" strokeWidth={2} name="BlockWards" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Points by Category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Points by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.pointsByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(240 8% 62%)' }} />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="achievement" fill="hsl(142 71% 45%)" name="Achievement" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="behaviour" fill="hsl(0 72% 51%)" name="Behaviour" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BlockWards by Category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">BlockWards by Category</CardTitle>
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
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {stats.blockWardsByCategory.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-sm text-muted-foreground capitalize">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title="No BlockWard data yet" />
            )}
          </CardContent>
        </Card>

        {/* Top Students */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Students by Achievement</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topStudents.length > 0 ? (
              <div className="space-y-3">
                {stats.topStudents.slice(0, 5).map((student, i) => (
                  <div key={student.email} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-warning/15 text-warning' :
                        i === 1 ? 'bg-muted text-muted-foreground' :
                        i === 2 ? 'bg-accent/15 text-accent' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{student.name}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="success" className="text-xs">+{student.achievement}</Badge>
                          <Badge variant="destructive" className="text-xs">-{student.behaviour}</Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {student.achievement - student.behaviour}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No student data yet" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}