import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Users, Award, Activity } from 'lucide-react';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    userGrowth: [],
    pointsOverTime: [],
    topStudents: [],
    classPerformance: [],
    attendanceRate: []
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [students, points, blockwards] = await Promise.all([
        base44.entities.UserProfile.filter({ user_type: 'student' }),
        base44.entities.PointEntry.list('-created_date', 100),
        base44.entities.BlockWard.list()
      ]);

      // Mock data for visualization
      const userGrowth = [
        { month: 'Jan', students: 45, teachers: 5 },
        { month: 'Feb', students: 67, teachers: 7 },
        { month: 'Mar', students: 89, teachers: 9 },
        { month: 'Apr', students: 112, teachers: 11 },
        { month: 'May', students: 134, teachers: 12 },
        { month: 'Jun', students: students.length, teachers: 15 }
      ];

      const pointsOverTime = [
        { week: 'Week 1', achievement: 120, behaviour: 30 },
        { week: 'Week 2', achievement: 180, behaviour: 45 },
        { week: 'Week 3', achievement: 230, behaviour: 20 },
        { week: 'Week 4', achievement: 290, behaviour: 35 }
      ];

      const topStudents = students
        .sort((a, b) => (b.total_achievement_points || 0) - (a.total_achievement_points || 0))
        .slice(0, 10)
        .map(s => ({
          name: `${s.first_name} ${s.last_name}`,
          points: s.total_achievement_points || 0
        }));

      const classPerformance = [
        { name: 'Mathematics', avg: 85, students: 25 },
        { name: 'Physics', avg: 78, students: 22 },
        { name: 'English', avg: 82, students: 28 },
        { name: 'Chemistry', avg: 75, students: 20 },
        { name: 'History', avg: 88, students: 24 }
      ];

      setStats({
        userGrowth,
        pointsOverTime,
        topStudents,
        classPerformance,
        attendanceRate: 92
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
        <p className="text-slate-500 mt-1">Comprehensive insights and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg Attendance</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">92%</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                <Users className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Points</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">8,245</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Award className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg Grade</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">B+</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Students</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">156</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Activity className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="growth" className="space-y-6">
        <TabsList>
          <TabsTrigger value="growth">User Growth</TabsTrigger>
          <TabsTrigger value="points">Points Tracking</TabsTrigger>
          <TabsTrigger value="performance">Class Performance</TabsTrigger>
          <TabsTrigger value="top">Top Performers</TabsTrigger>
        </TabsList>

        <TabsContent value="growth">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>User Growth Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="students" stroke="#8B5CF6" strokeWidth={2} />
                    <Line type="monotone" dataKey="teachers" stroke="#3B82F6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="points">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Points Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.pointsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="achievement" fill="#10B981" />
                    <Bar dataKey="behaviour" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Average Class Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.classPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avg" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Top 10 Students by Achievement Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topStudents.map((student, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center font-bold">
                        #{i + 1}
                      </div>
                      <span className="font-medium text-slate-900">{student.name}</span>
                    </div>
                    <span className="text-lg font-bold text-violet-600">{student.points}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}