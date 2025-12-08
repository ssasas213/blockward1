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
  Plus, Edit, Trash2, TrendingUp, TrendingDown, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function PointCategories() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'achievement',
    default_points: 5,
    color: '#8B5CF6',
    description: ''
  });

  const colors = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16'
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await base44.entities.PointCategory.list();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newCategory.name) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      const categoryData = {
        ...newCategory,
        default_points: newCategory.type === 'behaviour' 
          ? -Math.abs(newCategory.default_points) 
          : Math.abs(newCategory.default_points),
        school_id: profiles[0]?.school_id
      };

      if (editingCategory) {
        await base44.entities.PointCategory.update(editingCategory.id, categoryData);
        toast.success('Category updated');
      } else {
        await base44.entities.PointCategory.create(categoryData);
        toast.success('Category created');
      }

      setShowDialog(false);
      resetForm();
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      type: category.type,
      default_points: Math.abs(category.default_points),
      color: category.color || '#8B5CF6',
      description: category.description || ''
    });
    setShowDialog(true);
  };

  const handleDelete = async (categoryId) => {
    try {
      await base44.entities.PointCategory.delete(categoryId);
      loadCategories();
      toast.success('Category deleted');
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setNewCategory({
      name: '',
      type: 'achievement',
      default_points: 5,
      color: '#8B5CF6',
      description: ''
    });
  };

  const achievementCategories = categories.filter(c => c.type === 'achievement');
  const behaviourCategories = categories.filter(c => c.type === 'behaviour');

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
          <h1 className="text-3xl font-bold text-slate-900">Point Categories</h1>
          <p className="text-slate-500 mt-1">Configure achievement and behaviour point categories</p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
              <DialogDescription>
                {editingCategory ? 'Update the category details' : 'Add a new point category'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g. Excellence"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newCategory.type}
                  onValueChange={(value) => setNewCategory({ ...newCategory, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="achievement">Achievement (Positive)</SelectItem>
                    <SelectItem value="behaviour">Behaviour (Negative)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Points</Label>
                <Input
                  type="number"
                  min="1"
                  value={newCategory.default_points}
                  onChange={(e) => setNewCategory({ ...newCategory, default_points: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCategory({ ...newCategory, color })}
                      className={`h-8 w-8 rounded-full transition-transform ${
                        newCategory.color === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!newCategory.name || saving}
                className="bg-gradient-to-r from-violet-600 to-indigo-600"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingCategory ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Achievement Categories */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Achievement Categories</h2>
        </div>
        {achievementCategories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievementCategories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-12 w-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                        >
                          <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                          <Badge className="bg-green-100 text-green-700 mt-1">
                            +{Math.abs(cat.default_points)} points
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}>
                          <Edit className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                    {cat.description && (
                      <p className="text-sm text-slate-500">{cat.description}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="text-center py-8 text-slate-400">
              No achievement categories yet
            </CardContent>
          </Card>
        )}
      </div>

      {/* Behaviour Categories */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
            <TrendingDown className="h-4 w-4" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Behaviour Categories</h2>
        </div>
        {behaviourCategories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {behaviourCategories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-12 w-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                        >
                          <TrendingDown className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                          <Badge className="bg-red-100 text-red-700 mt-1">
                            {cat.default_points} points
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}>
                          <Edit className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                    {cat.description && (
                      <p className="text-sm text-slate-500">{cat.description}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="text-center py-8 text-slate-400">
              No behaviour categories yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}