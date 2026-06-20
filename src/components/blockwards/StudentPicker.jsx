import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, User, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function StudentPicker({ students, classes = [], selectedStudent, onSelect, debugInfo }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = classFilter === 'all' || student.classId === classFilter;
    return matchesSearch && matchesClass;
  });

  const showDebug = debugInfo && students.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Search Student</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type student name or email..."
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Filter by Class</Label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes ({students.length} students)</SelectItem>
              {classes.map((cls) => {
                const count = students.filter(s => s.classId === cls.id).length;
                return (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Debug panel — shown only when no students found */}
      {showDebug && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            No students found — Debug Info
          </div>
          <div className="text-xs text-amber-800 space-y-1 font-mono">
            <p>User ID: <span className="font-bold">{debugInfo.userId || 'N/A'}</span></p>
            <p>Teacher email: <span className="font-bold">{debugInfo.teacherEmail}</span></p>
            <p>School ID: <span className="font-bold">{debugInfo.schoolId || 'not set'}</span></p>
            <p>Classes loaded: <span className="font-bold">{debugInfo.classCount}</span></p>
            <p>Enrolled emails: <span className="font-bold">{debugInfo.enrolledEmailCount}</span></p>
            <p>All UserProfiles in DB: <span className="font-bold">{debugInfo.allProfilesCount || 'N/A'}</span></p>
            <p>Matched profiles: <span className="font-bold">{debugInfo.matchedProfilesCount || 0}</span></p>
            <p>Final student count: <span className="font-bold">{debugInfo.studentCount}</span></p>
          </div>
          {debugInfo.classCount === 0 && (
            <p className="text-xs text-amber-700 mt-2">
              ⚠️ No classes assigned to this teacher. Add students to a class first via the Classes page.
            </p>
          )}
          {debugInfo.classCount > 0 && debugInfo.enrolledEmailCount === 0 && (
            <p className="text-xs text-amber-700 mt-2">
              ⚠️ Classes found but no students enrolled. Add students via Class Detail → Add Student.
            </p>
          )}
          {debugInfo.enrolledEmailCount > 0 && debugInfo.studentCount === 0 && (
            <p className="text-xs text-amber-700 mt-2">
              ⚠️ Student emails found in class but no matching UserProfiles. Students may not have completed profile setup.
            </p>
          )}
          {debugInfo.allProfilesCount === 0 && (
            <p className="text-xs text-amber-700 mt-2">
              ⚠️ UserProfile entity is completely empty. No users have profiles in the system.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {students.length > 0 && filteredStudents.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No students match your search
            {classFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setClassFilter('all')}
                className="block mx-auto text-violet-600 text-sm underline mt-2"
              >
                Show all classes
              </button>
            )}
          </div>
        ) : students.length === 0 ? null : (
          filteredStudents.map((student) => (
            <button
              key={student.id}
              onClick={() => onSelect(student)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                selectedStudent?.id === student.id
                  ? "border-violet-600 bg-violet-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                {student.avatarUrl ? (
                  <img src={student.avatarUrl} alt={student.name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">{student.name[0]?.toUpperCase() || <User className="h-6 w-6 text-white" />}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{student.name}</p>
                <p className="text-sm text-slate-500 truncate">{student.email}</p>
                <Badge variant="outline" className="text-xs mt-1">{student.className}</Badge>
              </div>
              {selectedStudent?.id === student.id && (
                <div className="h-6 w-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}