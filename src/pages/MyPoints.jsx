import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Award, TrendingUp, TrendingDown, Calendar, Star
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export default function MyPoints() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [points, setPoints] = useState([]);
  const [stats, setStats] = useState({
    totalAchievement: 0,
    totalBehaviour: 0,
    byCategory: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        
        const pointEntries = await base44.entities.PointEntry.filter(
          { student_email: user.email },
          '-created_date'
        );
        setPoints(pointEntries);

        // Calculate stats
        let totalAchievement = 0;
        let totalBehaviour = 0;
        const categoryTotals = {};

        pointEntries.forEach(p => {
          if (p.type === 'achievement') totalAchievement += p.points;
          else totalBehaviour += Math.abs(p.points);

          const cat = p.category_name || 'Other';
          if (!categoryTotals[cat]) categoryTotals[cat] = { name: cat, value: 0, type: p.type };
          categoryTotals[cat].value += Math.abs(p.points);
        });

        setStats({
          totalAchievement: profiles[0].total_achievement_points || totalAchievement,
          totalBehaviour: profiles[0].total_behaviour_points || totalBehaviour,
          byCategory: Object.values(categoryTotals)
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const achievementPoints = points.filter(p => p.type === 'achievement');
  const behaviourPoints = points.filter(p => p.type === 'behaviour');

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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Points</h1>
        <p className="text-slate-500 mt-1">Track your achievement and behaviour points</p>
      </div>

      {/* Stats Cards */}
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
                  <p className="text-emerald-100">Total Achievement</p>
                  <p className="text-4xl font-bold mt-1">{stats.totalAchievement}</p>
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
                  <p className="text-4xl font-bold mt-1">{stats.totalBehaviour}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <TrendingDown className="h-7 w-7" />
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
                  <p className="text-violet-100">Net Points</p>
                  <p className="text-4xl font-bold mt-1">{stats.totalAchievement - stats.totalBehaviour}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Star className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points by Category */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Points by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byCategory.length > 0 ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.byCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {stats.byCategory.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-slate-600">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No point data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Points Over Time */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {points.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={points.slice(0, 10).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="category_name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="points" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No point data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Points History */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="all">All ({points.length})</TabsTrigger>
          <TabsTrigger value="achievement">Achievements ({achievementPoints.length})</TabsTrigger>
          <TabsTrigger value="behaviour">Behaviour ({behaviourPoints.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PointsList points={points} />
        </TabsContent>
        <TabsContent value="achievement">
          <PointsList points={achievementPoints} />
        </TabsContent>
        <TabsContent value="behaviour">
          <PointsList points={behaviourPoints} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PointsList({ points }) {
  if (points.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-12">
          <Award className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No points recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-0 divide-y divide-slate-100">
        {points.map((point, i) => (
          <motion.div
            key={point.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 flex items-center justify-between hover:bg-slate-50"
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                point.type === 'achievement' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {point.type === 'achievement' ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              </div>
              <div>
                <p className="font-medium text-slate-900">{point.category_name || 'Points'}</p>
                <p className="text-sm text-slate-500">{point.reason}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{point.class_name}</Badge>
                  <span className="text-xs text-slate-400">by {point.teacher_name}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={point.type === 'achievement' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {point.points > 0 ? '+' : ''}{point.points}
              </Badge>
              <p className="text-xs text-slate-400 mt-1">
                {point.timestamp && format(new Date(point.timestamp), 'MMM d, h:mm a')}
              </p>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}