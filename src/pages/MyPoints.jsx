import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import EmptyState from '@/components/ui/empty-state';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import {
  Award, TrendingUp, TrendingDown, Star
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

const CHART_COLORS = [
  'hsl(258 90% 66%)', 'hsl(330 81% 60%)', 'hsl(239 84% 67%)',
  'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(280 60% 55%)',
];

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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Points" description="Track your achievement and behaviour points" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Points" description="Track your achievement and behaviour points" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Achievement" value={stats.totalAchievement} icon={TrendingUp} accentColor="success" />
        <StatCard label="Behaviour Points" value={stats.totalBehaviour} icon={TrendingDown} accentColor="warning" />
        <StatCard label="Net Points" value={stats.totalAchievement - stats.totalBehaviour} icon={Star} accentColor="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points by Category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Points by Category</CardTitle>
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
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(252 21% 10%)',
                          border: '1px solid hsl(0 0% 100% / 0.1)',
                          borderRadius: '0.5rem',
                          color: 'hsl(0 0% 95%)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {stats.byCategory.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-sm text-muted-foreground">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={Award} title="No point data yet" />
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {points.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={points.slice(0, 10).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.08)" />
                    <XAxis dataKey="category_name" tick={{ fontSize: 12, fill: 'hsl(240 8% 62%)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(240 8% 62%)' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(252 21% 10%)',
                        border: '1px solid hsl(0 0% 100% / 0.1)',
                        borderRadius: '0.5rem',
                        color: 'hsl(0 0% 95%)',
                      }}
                    />
                    <Bar dataKey="points" fill="hsl(258 90% 66%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={Award} title="No point data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Points History */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
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
      <Card>
        <CardContent>
          <EmptyState icon={Award} title="No points recorded yet" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {points.map((point, i) => (
          <motion.div
            key={point.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 flex items-center justify-between hover:bg-hover/50 transition-colors"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                point.type === 'achievement' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
              }`}>
                {point.type === 'achievement' ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{point.category_name || 'Points'}</p>
                <p className="text-sm text-muted-foreground truncate">{point.reason}</p>
                <div className="flex items-center gap-2 mt-1">
                  {point.class_name && <Badge variant="outline" className="text-xs">{point.class_name}</Badge>}
                  <span className="text-xs text-muted-foreground">by {point.teacher_name}</span>
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <Badge variant={point.type === 'achievement' ? 'success' : 'destructive'}>
                {point.points > 0 ? '+' : ''}{point.points}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {point.timestamp && format(new Date(point.timestamp), 'MMM d, h:mm a')}
              </p>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}