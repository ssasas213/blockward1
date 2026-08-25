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
import EmptyState from '@/components/ui/empty-state';

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

      const res = await base44.functions.invoke('createResource', {
        class_id: newResource.class_id,
        class_name: selectedClass?.name,
        title: newResource.title,
        description: newResource.description,
        category: newResource.category,
        file_url,
        file_type: getFileType(selectedFile.name),
        file_size: selectedFile.size,
        school_id: profile?.school_id,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      
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
    pdf: 'bg-destructive/15 text-destructive',
    document: 'bg-info/15 text-info',
    image: 'bg-success/15 text-success',
    video: 'bg-primary/15 text-primary',
    other: 'bg-muted text-muted-foreground'
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
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Resources</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher ? 'Upload and manage learning materials' : 'Access class materials'}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button>
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
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
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
                          <FileText className="h-8 w-8 text-primary" />
                          <div className="text-left">
                            <p className="font-medium text-foreground">{selectedFile.name}</p>
                            <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Click to select a file</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">PDF, DOC, Images, Video</p>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              <Card className="card-hover transition-all">
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
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{resource.title}</h3>
                  {resource.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{resource.description}</p>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="outline">{resource.class_name}</Badge>
                    <span className="text-xs text-muted-foreground">
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
        <EmptyState
          icon={Folder}
          title="No resources yet"
          description={isTeacher ? 'Upload your first learning material' : 'No resources have been shared yet'}
        />
      )}
    </div>
  );
}