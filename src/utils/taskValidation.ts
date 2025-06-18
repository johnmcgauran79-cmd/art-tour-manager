
export interface TaskValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateTaskData = (taskData: {
  title: string;
  description?: string;
  priority: string;
  category: string;
  due_date?: string;
  depends_on_task_id?: string;
  assignee_ids?: string[];
}): TaskValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required field validation
  if (!taskData.title?.trim()) {
    errors.push('Task title is required');
  } else if (taskData.title.trim().length < 3) {
    errors.push('Task title must be at least 3 characters long');
  } else if (taskData.title.trim().length > 200) {
    errors.push('Task title must be less than 200 characters');
  }

  // Description validation
  if (taskData.description && taskData.description.length > 2000) {
    errors.push('Task description must be less than 2000 characters');
  }

  // Priority validation
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (!validPriorities.includes(taskData.priority)) {
    errors.push('Invalid priority level');
  }

  // Category validation
  const validCategories = ['booking', 'operations', 'finance', 'marketing', 'maintenance', 'general'];
  if (!validCategories.includes(taskData.category)) {
    errors.push('Invalid task category');
  }

  // Due date validation
  if (taskData.due_date) {
    const dueDate = new Date(taskData.due_date);
    const now = new Date();
    
    if (isNaN(dueDate.getTime())) {
      errors.push('Invalid due date format');
    } else {
      // Check if due date is in the past
      if (dueDate < now) {
        warnings.push('Due date is in the past');
      }
      
      // Check if due date is too far in the future (more than 2 years)
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
      if (dueDate > twoYearsFromNow) {
        warnings.push('Due date is more than 2 years in the future');
      }
    }
  }

  // Assignment validation
  if (taskData.assignee_ids && taskData.assignee_ids.length > 10) {
    warnings.push('Task is assigned to many users (>10) - consider breaking it down');
  }

  // Dependency validation (basic check - detailed validation would require checking against existing tasks)
  if (taskData.depends_on_task_id === 'self') {
    errors.push('Task cannot depend on itself');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const validateBulkTaskOperation = (
  taskIds: string[],
  operation: string,
  updateData?: any
): TaskValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!taskIds || taskIds.length === 0) {
    errors.push('No tasks selected for bulk operation');
  } else if (taskIds.length > 100) {
    warnings.push('Large bulk operation (>100 tasks) - consider breaking it down');
  }

  // Operation-specific validation
  switch (operation) {
    case 'update_status':
      const validStatuses = ['not_started', 'in_progress', 'waiting', 'completed', 'cancelled', 'archived'];
      if (!updateData?.status || !validStatuses.includes(updateData.status)) {
        errors.push('Invalid status for bulk update');
      }
      break;

    case 'update_priority':
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!updateData?.priority || !validPriorities.includes(updateData.priority)) {
        errors.push('Invalid priority for bulk update');
      }
      break;

    case 'assign':
      if (!updateData?.userIds || updateData.userIds.length === 0) {
        errors.push('No users selected for bulk assignment');
      }
      break;

    case 'delete':
      warnings.push('Bulk delete operation cannot be undone');
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const sanitizeTaskInput = (input: string): string => {
  if (!input) return '';
  
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
};
