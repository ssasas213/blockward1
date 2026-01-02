import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, User } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function StudentPicker({ students, selectedStudent, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  const classes = [...new Set(students.map(s => s.class))];

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = classFilter === 'all' || student.class === classFilter;
    return matchesSearch && matchesClass;
  });

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
              placeholder="Type student name..."
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
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No students found
          </div>
        ) : (
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
                  <User className="h-6 w-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{student.name}</p>
                <p className="text-sm text-slate-500">{student.class}</p>
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