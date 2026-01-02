import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Award, Plus, Search, Info, Loader2 } from 'lucide-react';
import StatusBadge from '@/components/blockwards/StatusBadge';
import ActivityTimeline from '@/components/blockwards/ActivityTimeline';
import { api } from '@/components/blockwards/mockData';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function TeacherBlockWards() {
  const [loading, setLoading] = useState(true);
  const [issuedBlockWards, setIssuedBlockWards] = useState([]);
  const [activityTimeline, setActivityTimeline] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [issued, timeline] = await Promise.all([
        api.getTeacherIssuedBlockWards(),
        api.getActivityTimeline()
      ]);
      setIssuedBlockWards(issued);
      setActivityTimeline(timeline);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBlockWards = issuedBlockWards.filter(bw => {
    const matchesSearch = 
      bw.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bw.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bw.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: issuedBlockWards.length,
    pending: issuedBlockWards.filter(bw => bw.status === 'pending').length,
    issued: issuedBlockWards.filter(bw => bw.status === 'minted').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">BlockWards</h1>
          <p className="text-slate-500 mt-1">Issue and manage student achievements</p>
        </div>
        <Button 
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          asChild
        >
          <Link to={createPageUrl('IssueBlockWard')}>
            <Plus className="h-4 w-4 mr-2" />
            Issue a BlockWard
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Issued</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stats.total}</p>
                </div>
                <div className="h-14 w-14 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Award className="h-7 w-7 text-violet-600" />
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
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Successfully Issued</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{stats.issued}</p>
                </div>
                <div className="h-14 w-14 rounded-xl bg-green-100 flex items-center justify-center">
                  <Award className="h-7 w-7 text-green-600" />
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
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Pending</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
                </div>
                <div className="h-14 w-14 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Award className="h-7 w-7 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Policy Banner */}
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
              <Info className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">About BlockWards</h3>
              <p className="text-sm text-slate-600">
                BlockWards are permanent achievements that are securely stored and cannot be transferred. 
                Each award is uniquely tied to the student who earned it.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Issued BlockWards */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Recent Issued BlockWards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search student or award..."
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="minted">Issued</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredBlockWards.length === 0 ? (
            <div className="text-center py-12">
              <Award className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No BlockWards yet</h3>
              <p className="text-slate-500 mb-6">
                Start recognizing your students' achievements by issuing your first BlockWard
              </p>
              <Button asChild>
                <Link to={createPageUrl('IssueBlockWard')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Issue First BlockWard
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Student</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">BlockWard</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBlockWards.map((bw) => (
                    <tr key={bw.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-4">
                        <p className="font-medium text-slate-900">{bw.studentName}</p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{bw.icon}</span>
                          <p className="font-medium text-slate-900">{bw.title}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline">{bw.category}</Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {format(new Date(bw.issuedAt), 'MMM d, yyyy')}
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={bw.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <ActivityTimeline activities={activityTimeline} />
    </div>
  );
}