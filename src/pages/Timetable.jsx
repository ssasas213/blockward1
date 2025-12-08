import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, Calendar, Clock, MapPin, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
];

export default function Timetable() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [classes, setClasses] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 0 : new Date().getDay() - 1);
  const [newEntry, setNewEntry] = useState({
    class_id: '',
    day_of_week: 0,
    start_time: '',
    end_time: '',
    room: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        const userProfile = profiles[0];
        setProfile(userProfile);

        let scheduleData = [];
        let classData = [];

        if (userProfile.user_type === 'teacher') {
          scheduleData = await base44.entities.TimetableEntry.filter({ teacher_email: user.email });
          classData = await base44.entities.Class.filter({ teacher_email: user.email });
        } else if (userProfile.user_type === 'student') {
          const allClasses = await base44.entities.Class.list();
          const myClasses = allClasses.filter(c => c.student_emails?.includes(user.email));
          classData = myClasses;
          
          const allSchedules = await base44.entities.TimetableEntry.list();
          const classIds = myClasses.map(c => c.id);
          scheduleData = allSchedules.filter(s => classIds.includes(s.class_id));
        } else {
          scheduleData = await base44.entities.TimetableEntry.list();
          classData = await base44.entities.Class.list();
        }

        setSchedule(scheduleData);
        setClasses(classData);
      }
    } catch (error) {
      console.error('Error loading timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.class_id || !newEntry.start_time || !newEntry.end_time) return;
    
    setAdding(true);
    try {
      const user = await base44.auth.me();
      const selectedClass = classes.find(c => c.id === newEntry.class_id);

      const entryData = {
        ...newEntry,
        teacher_email: user.email,
        subject: selectedClass?.subject,
        class_name: selectedClass?.name,
        school_id: profile?.school_id
      };

      await base44.entities.TimetableEntry.create(entryData);
      setShowAddDialog(false);
      setNewEntry({ class_id: '', day_of_week: 0, start_time: '', end_time: '', room: '' });
      loadData();
      toast.success('Timetable entry added!');
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('Failed to add entry');
    } finally {
      setAdding(false);
    }
  };

  const getEntriesForDay = (dayIndex) => {
    return schedule
      .filter(s => s.day_of_week === dayIndex)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const classColors = [
    'bg-violet-100 border-violet-300 text-violet-700',
    'bg-blue-100 border-blue-300 text-blue-700',
    'bg-emerald-100 border-emerald-300 text-emerald-700',
    'bg-rose-100 border-rose-300 text-rose-700',
    'bg-amber-100 border-amber-300 text-amber-700',
    'bg-indigo-100 border-indigo-300 text-indigo-700'
  ];

  const getColorForClass = (classId) => {
    const index = classes.findIndex(c => c.id === classId);
    return classColors[index % classColors.length];
  };

  const isTeacher = profile?.user_type === 'teacher' || profile?.user_type === 'admin';

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
          <h1 className="text-3xl font-bold text-slate-900">Timetable</h1>
          <p className="text-slate-500 mt-1">
            {profile?.user_type === 'student' ? 'Your class schedule' : 'Your teaching schedule'}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Timetable Entry</DialogTitle>
                <DialogDescription>
                  Schedule a class period
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select
                    value={newEntry.class_id}
                    onValueChange={(value) => setNewEntry({ ...newEntry, class_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Day</Label>
                  <Select
                    value={String(newEntry.day_of_week)}
                    onValueChange={(value) => setNewEntry({ ...newEntry, day_of_week: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((day, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Select
                      value={newEntry.start_time}
                      onValueChange={(value) => setNewEntry({ ...newEntry, start_time: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Start" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Select
                      value={newEntry.end_time}
                      onValueChange={(value) => setNewEntry({ ...newEntry, end_time: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="End" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Input
                    value={newEntry.room}
                    onChange={(e) => setNewEntry({ ...newEntry, room: e.target.value })}
                    placeholder="e.g. A101"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddEntry}
                  disabled={!newEntry.class_id || !newEntry.start_time || !newEntry.end_time || adding}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Entry'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Mobile Day Selector */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedDay(Math.max(0, selectedDay - 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">{DAYS[selectedDay]}</h2>
          <Button variant="ghost" size="icon" onClick={() => setSelectedDay(Math.min(4, selectedDay + 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            {getEntriesForDay(selectedDay).length > 0 ? (
              <div className="space-y-3">
                {getEntriesForDay(selectedDay).map((entry) => (
                  <div key={entry.id} className={`p-4 rounded-xl border-2 ${getColorForClass(entry.class_id)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{entry.start_time} - {entry.end_time}</span>
                      {entry.room && <Badge variant="outline">{entry.room}</Badge>}
                    </div>
                    <p className="font-semibold">{entry.class_name || entry.subject}</p>
                    <p className="text-sm opacity-80">{entry.subject}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No classes scheduled</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Desktop Week View */}
      <div className="hidden md:block">
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="grid grid-cols-5 divide-x divide-slate-200">
            {DAYS.map((day, dayIndex) => {
              const dayEntries = getEntriesForDay(dayIndex);
              const isToday = new Date().getDay() === dayIndex + 1;
              
              return (
                <div key={day} className={`min-h-[500px] ${isToday ? 'bg-violet-50/50' : ''}`}>
                  <div className={`p-4 border-b ${isToday ? 'bg-violet-100' : 'bg-slate-50'}`}>
                    <h3 className={`font-semibold ${isToday ? 'text-violet-700' : 'text-slate-700'}`}>
                      {day}
                    </h3>
                    {isToday && <Badge className="mt-1 bg-violet-600">Today</Badge>}
                  </div>
                  <div className="p-3 space-y-2">
                    {dayEntries.length > 0 ? (
                      dayEntries.map((entry, i) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`p-3 rounded-lg border-2 ${getColorForClass(entry.class_id)}`}
                        >
                          <div className="flex items-center gap-1 text-xs mb-1">
                            <Clock className="h-3 w-3" />
                            <span>{entry.start_time} - {entry.end_time}</span>
                          </div>
                          <p className="font-semibold text-sm">{entry.class_name || entry.subject}</p>
                          {entry.room && (
                            <div className="flex items-center gap-1 text-xs mt-1 opacity-80">
                              <MapPin className="h-3 w-3" />
                              <span>{entry.room}</span>
                            </div>
                          )}
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        No classes
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Legend */}
      {classes.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {classes.map((cls, i) => (
                <div
                  key={cls.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${classColors[i % classColors.length]}`}
                >
                  <span className="text-sm font-medium">{cls.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}