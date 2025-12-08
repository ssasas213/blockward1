import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  FileText, Upload, Search, Download, Folder, 
  Loader2, Trash2, ExternalLink, File, Image, Video
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Resources() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [resources, setResources] = useState([]);
  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newResource, setNewResource] = useState({
    class_id: '',
    title: '',
    description: '',
    category: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const preselectedClass = urlParams.get('class');

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

        let classData = [];
        let resourceData = [];

        if (userProfile.user_type === 'teacher') {
          classData = await base44.entities.Class.filter({ teacher_email: user.email });
          resourceData = await base44.entities.Resource.filter({ teacher_email: user.email }, '-created_date');
        } else if (userProfile.user_type === 'student') {
          const allClasses = await base44.entities.Class.list();
          classData = allClasses.filter(c => c.student_emails?.includes(user.email));
          const classIds = classData.map(c => c.id);
          const allResources = await base44.entities.Resource.list('-created_date');
          resourceData = allResources.filter(r => classIds.includes(r.class_id));
        } else {
          classData = await base44.entities.Class.list();
          resourceData = await base44.entities.Resource.list('-created_date');
        }

        setClasses(classData);
        setResources(resourceData);

        if (preselectedClass) {
          setNewResource(prev => ({ ...prev, class_id: preselectedClass }));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (!newResource.title) {
        setNewResource({ ...newResource, title: file.name.split('.')[0] });
      }
    }
  };

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx', 'txt'].includes(ext)) return 'document';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
    return 'other';
  };

  const handleUpload = async () => {
    if (!selectedFile || !newResource.class_id || !newResource.title) return;

    setUploading(true);
    try {
      const user = await base44.auth.me();
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      
      const selectedClass = classes.find(c => c.id === newResource.class_id);

      const resourceData = {
        ...newResource,
        file_url,
        file_type: getFileType(selectedFile.name),
        file_size: selectedFile.size,
        class_name: selectedClass?.name,
        teacher_email: user.email,
        school_id: profile?.school_id
      };

      await base44.entities.Resource.create(resourceData);
      
      setShowUploadDialog(false);
      setNewResource({ class_id: preselectedClass || '', title: '', description: '', category: '' });
      setSelectedFile(null);
      loadData();
      toast.success('Resource uploaded successfully!');
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Failed to upload resource');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (resourceId) => {
    try {
      await base44.entities.Resource.delete(resourceId);
      loadData();
      toast.success('Resource deleted');
    } catch (error) {
      toast.error('Failed to delete resource');
    }
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf': return <FileText className="h-6 w-6" />;
      case 'image': return <Image className="h-6 w-6" />;
      case 'video': return <Video className="h-6 w-6" />;
      default: return <File className="h-6 w-6" />;
    }
  };

  const fileTypeColors = {
    pdf: 'bg-red-100 text-red-600',
    document: 'bg-blue-100 text-blue-600',
    image: 'bg-green-100 text-green-600',
    video: 'bg-purple-100 text-purple-600',
    other: 'bg-slate-100 text-slate-600'
  };

  const isTeacher = profile?.user_type === 'teacher' || profile?.user_type === 'admin';

  const filteredResources = resources.filter(r => {
    const matchesSearch = r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass === 'all' || r.class_id === filterClass;
    return matchesSearch && matchesClass;
  });

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
          <h1 className="text-3xl font-bold text-slate-900">Resources</h1>
          <p className="text-slate-500 mt-1">
            {isTeacher ? 'Upload and manage learning materials' : 'Access class materials'}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Upload className="h-4 w-4 mr-2" />
                Upload Resource
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Resource</DialogTitle>
                <DialogDescription>
                  Share learning materials with your class
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select
                    value={newResource.class_id}
                    onValueChange={(value) => setNewResource({ ...newResource, class_id: value })}
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
                  <Label>File *</Label>
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-violet-300 transition-colors">
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mov"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileText className="h-8 w-8 text-violet-500" />
                          <div className="text-left">
                            <p className="font-medium text-slate-900">{selectedFile.name}</p>
                            <p className="text-sm text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                          <p className="text-slate-600">Click to select a file</p>
                          <p className="text-xs text-slate-400 mt-1">PDF, DOC, Images, Video</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={newResource.title}
                    onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                    placeholder="Resource title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newResource.description}
                    onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
                    placeholder="Brief description..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={newResource.category}
                    onValueChange={(value) => setNewResource({ ...newResource, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notes">Notes</SelectItem>
                      <SelectItem value="textbook">Textbook</SelectItem>
                      <SelectItem value="worksheet">Worksheet</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload}
                  disabled={!selectedFile || !newResource.class_id || !newResource.title || uploading}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search resources..."
            className="pl-10"
          />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resources Grid */}
      {filteredResources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource, i) => (
            <motion.div
              key={resource.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${fileTypeColors[resource.file_type] || fileTypeColors.other}`}>
                      {getFileIcon(resource.file_type)}
                    </div>
                    {isTeacher && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(resource.id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{resource.title}</h3>
                  {resource.description && (
                    <p className="text-sm text-slate-500 mb-3 line-clamp-2">{resource.description}</p>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="outline">{resource.class_name}</Badge>
                    <span className="text-xs text-slate-400">
                      {resource.created_date && format(new Date(resource.created_date), 'MMM d')}
                    </span>
                  </div>
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-16">
            <Folder className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No resources yet</h3>
            <p className="text-slate-500 mb-6">
              {isTeacher ? 'Upload your first learning material' : 'No resources have been shared yet'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}