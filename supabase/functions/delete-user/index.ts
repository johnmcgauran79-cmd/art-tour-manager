
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the request is from an authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the current user from the auth header using service role client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the requesting user is an admin using service role client
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || userRole?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the user ID to delete from request body
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent admins from deleting themselves
    if (userId === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get an admin user to reassign tasks to
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .neq('user_id', userId) // Don't use the user being deleted
      .limit(1)
      .single()

    if (adminError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'No admin user found for task reassignment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminUserId = adminUser.user_id

    // Handle task reassignment before deleting user
    try {
      // Find all tasks assigned to the user being deleted
      const { data: userTasks, error: tasksError } = await supabaseAdmin
        .from('task_assignments')
        .select('task_id')
        .eq('user_id', userId)

      if (tasksError) {
        console.error('Error fetching user tasks:', tasksError)
      } else if (userTasks && userTasks.length > 0) {
        const taskIds = userTasks.map(t => t.task_id)

        // For each task, check how many users are assigned
        for (const taskId of taskIds) {
          const { data: taskAssignments, error: assignmentError } = await supabaseAdmin
            .from('task_assignments')
            .select('user_id')
            .eq('task_id', taskId)

          if (!assignmentError && taskAssignments) {
            if (taskAssignments.length === 1) {
              // Only assigned to the deleted user - reassign to admin
              await supabaseAdmin
                .from('task_assignments')
                .update({ user_id: adminUserId })
                .eq('task_id', taskId)
                .eq('user_id', userId)
              
              console.log(`Reassigned task ${taskId} to admin ${adminUserId}`)
            } else {
              // Multiple users assigned - just remove the deleted user
              await supabaseAdmin
                .from('task_assignments')
                .delete()
                .eq('task_id', taskId)
                .eq('user_id', userId)
              
              console.log(`Removed user ${userId} from task ${taskId}`)
            }
          }
        }
      }

      // Update tasks created by the deleted user to be owned by admin
      const { error: updateTasksError } = await supabaseAdmin
        .from('tasks')
        .update({ created_by: adminUserId })
        .eq('created_by', userId)

      if (updateTasksError) {
        console.error('Error updating task ownership:', updateTasksError)
      } else {
        console.log(`Updated task ownership for tasks created by ${userId}`)
      }

      // Update task assignments where the deleted user was the one who assigned tasks
      const { error: updateAssignedByError } = await supabaseAdmin
        .from('task_assignments')
        .update({ assigned_by: adminUserId })
        .eq('assigned_by', userId)

      if (updateAssignedByError) {
        console.error('Error updating task assignment assigned_by:', updateAssignedByError)
      } else {
        console.log(`Updated assigned_by references for user ${userId}`)
      }

      // Update task comments to transfer ownership to admin user
      const { error: updateCommentsError } = await supabaseAdmin
        .from('task_comments')
        .update({ user_id: adminUserId })
        .eq('user_id', userId)

      if (updateCommentsError) {
        console.error('Error updating task comments user_id:', updateCommentsError)
      } else {
        console.log(`Updated task comments ownership for user ${userId}`)
      }

      // Update booking comments to transfer ownership to admin user
      const { error: updateBookingCommentsError } = await supabaseAdmin
        .from('booking_comments')
        .update({ user_id: adminUserId })
        .eq('user_id', userId)

      if (updateBookingCommentsError) {
        console.error('Error updating booking comments user_id:', updateBookingCommentsError)
      } else {
        console.log(`Updated booking comments ownership for user ${userId}`)
      }

      // Update any file attachments uploaded by the user
      const { error: updateTaskAttachmentsError } = await supabaseAdmin
        .from('task_attachments')
        .update({ uploaded_by: adminUserId })
        .eq('uploaded_by', userId)

      if (updateTaskAttachmentsError) {
        console.error('Error updating task attachments uploaded_by:', updateTaskAttachmentsError)
      } else {
        console.log(`Updated task attachments ownership for user ${userId}`)
      }

      const { error: updateTourAttachmentsError } = await supabaseAdmin
        .from('tour_attachments')
        .update({ uploaded_by: adminUserId })
        .eq('uploaded_by', userId)

      if (updateTourAttachmentsError) {
        console.error('Error updating tour attachments uploaded_by:', updateTourAttachmentsError)
      } else {
        console.log(`Updated tour attachments ownership for user ${userId}`)
      }

      const { error: updateHotelAttachmentsError } = await supabaseAdmin
        .from('hotel_attachments')
        .update({ uploaded_by: adminUserId })
        .eq('uploaded_by', userId)

      if (updateHotelAttachmentsError) {
        console.error('Error updating hotel attachments uploaded_by:', updateHotelAttachmentsError)
      } else {
        console.log(`Updated hotel attachments ownership for user ${userId}`)
      }

    } catch (taskError) {
      console.error('Error handling task reassignment:', taskError)
      // Continue with deletion even if task reassignment fails
    }

    // Delete the user using admin client
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
