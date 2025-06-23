import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TaskTemplate, useTaskTemplates, useDeleteTaskTemplate } from "@/hooks/useTaskTemplates";
import { TaskTemplateModal } from "@/components/TaskTemplateModal";
import { Plus, Edit, Trash2, Settings, Calendar, AlertTriangle, RefreshCw } from "lucide-react";

export const TaskTemplatesManagement = () => {
  const { data: templates, isLoading, error, refetch } = useTaskTemplates();
  const deleteTemplate = useDeleteTaskTemplate();
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  console.log('TaskTemplatesManagement render - Templates data:', templates);
  console.log('TaskTemplatesManagement render - Templates loading:', isLoading);
  console.log('TaskTemplatesManagement render - Templates error:', error);
  console.log('TaskTemplatesManagement render - Templates count:', templates?.length);

  const handleEditTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setModalOpen(true);
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setSelectedTemplate(null);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate.mutateAsync(templateId);
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleRefresh = () => {
    console.log('Manually refreshing task templates...');
    refetch();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'booking': return 'bg-blue-100 text-blue-800';
      case 'operations': return 'bg-green-100 text-green-800';
      case 'finance': return 'bg-yellow-100 text-yellow-800';
      case 'marketing': return 'bg-purple-100 text-purple-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Task Templates Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading task templates...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Task Templates Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            <p>Error loading templates: {error.message}</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeTemplates = templates?.filter(t => t.is_active) || [];
  const inactiveTemplates = templates?.filter(t => !t.is_active) || [];

  console.log('Active templates:', activeTemplates);
  console.log('Inactive templates:', inactiveTemplates);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">Task Templates Management</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                {templates?.length || 0} templates
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRefresh}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={handleCreateTemplate}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Debug information */}
          <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
            <p><strong>Debug Info:</strong></p>
            <p>Templates array: {JSON.stringify(templates)}</p>
            <p>Is loading: {isLoading.toString()}</p>
            <p>Error: {error?.message || 'None'}</p>
          </div>

          <div className="space-y-6">
            {/* Show all templates if we have any */}
            {templates && templates.length > 0 ? (
              <>
                {/* Active Templates */}
                {activeTemplates.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-green-600" />
                      Active Templates ({activeTemplates.length})
                    </h3>
                    <div className="grid gap-4">
                      {activeTemplates.map((template) => (
                        <div 
                          key={template.id} 
                          className="border rounded-lg p-4 bg-white shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{template.name}</h4>
                                <Badge className={getCategoryColor(template.category)}>
                                  {template.category}
                                </Badge>
                                <Badge className={getPriorityColor(template.priority)}>
                                  {template.priority}
                                </Badge>
                                {template.days_before_tour && (
                                  <Badge variant="outline" className="text-xs">
                                    {template.days_before_tour} days before tour
                                  </Badge>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                              )}
                              <p className="text-xs text-gray-500">
                                Created: {new Date(template.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTemplate(template)}
                                className="flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    disabled={deleteTemplate.isPending}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{template.name}"? This action cannot be undone.
                                      This will not affect existing tasks created from this template.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteTemplate(template.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Template
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inactive Templates */}
                {inactiveTemplates.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-gray-500" />
                      Inactive Templates ({inactiveTemplates.length})
                    </h3>
                    <div className="grid gap-4">
                      {inactiveTemplates.map((template) => (
                        <div 
                          key={template.id} 
                          className="border rounded-lg p-4 bg-gray-50 shadow-sm opacity-70 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-700">{template.name}</h4>
                                <Badge className={getCategoryColor(template.category)}>
                                  {template.category}
                                </Badge>
                                <Badge className={getPriorityColor(template.priority)}>
                                  {template.priority}
                                </Badge>
                                <Badge variant="secondary" className="bg-gray-200 text-gray-600">
                                  Inactive
                                </Badge>
                              </div>
                              {template.description && (
                                <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTemplate(template)}
                                className="flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    disabled={deleteTemplate.isPending}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Template</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{template.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteTemplate(template.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Template
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show message if all templates are inactive */}
                {activeTemplates.length === 0 && inactiveTemplates.length > 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No active templates found</p>
                    <p className="text-sm">All templates are currently inactive</p>
                  </div>
                )}
              </>
            ) : (
              /* No templates at all */
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Task Templates</h3>
                <p className="mb-4">Create your first task template to get started with automated task management.</p>
                <Button onClick={handleCreateTemplate} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Template
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <TaskTemplateModal
        template={selectedTemplate}
        open={modalOpen}
        onOpenChange={handleModalClose}
      />
    </>
  );
};
