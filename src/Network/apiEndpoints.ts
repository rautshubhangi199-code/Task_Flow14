export const API_ENDPOINTS = {
  // development
  BASE_URL: 'http://192.168.1.9:8000/api/',

  // Use Vite proxy instead of the IP if the browser blocks CORS:
  // BASE_URL: '/api/',

  // Organization
  POST_create_organization: 'create-organization/',
  GET_all_organizations: 'get-all-organizations/',
  GET_organization_by_id: 'get-organization-by-id/',
  UPDATE_organization: 'update-organization/',
  DELETE_organization: 'delete-organization/',

  // Accounts
  POST_login: 'login/',
  GET_user_summary: 'get-user-summary/',
  GET_all_users: 'get-all-users/',
  GET_user_by_id: 'get-user-by-id/',
  POST_invite_users: 'invite-users/',
  UPDATE_user: 'update-user/',
  POST_activate_user: 'activate-user/',

  // Roles & permissions
  POST_create_role: 'create-role/',
  GET_all_roles: 'get-all-roles/',
  GET_role_by_id: 'get-role-by-id/',
  UPDATE_role: 'update-role/',
  DELETE_role: 'delete-role/',
  POST_create_permission: 'create-permission/',
  GET_all_permissions: 'get-all-permissions/',
  GET_permission_by_id: 'get-permission-by-id/',
  UPDATE_permission: 'update-permission/',
  DELETE_permission: 'delete-permission/',
  POST_create_role_permission: 'create-role-permission/',
  GET_all_role_permissions: 'get-all-role-permissions/',
  DELETE_role_permission: 'delete-role-permission/',

  // Teams
  POST_create_team: 'create-team/',
  GET_all_teams: 'get-all-teams/',
  GET_team_by_id: 'get-team-by-id/',
  UPDATE_team: 'update-team/',
  DELETE_team: 'delete-team/',

  // Projects / spaces
  POST_create_project: 'create-project/',
  GET_all_projects: 'get-all-projects/',
  GET_project_by_id: 'get-project-by-id/',
  UPDATE_project: 'update-project/',
  DELETE_project: 'delete-project/',
  GET_project_summary: 'get-project-summary/',
  POST_create_project_member: 'create-project-member/',
  GET_all_project_members: 'get-all-project-members/',
  DELETE_project_member: 'delete-project-member/',

  // Sprints
  POST_create_sprint: 'create-sprint/',
  GET_all_sprints: 'get-all-sprints/',
  GET_sprint_by_id: 'get-sprint-by-id/',
  UPDATE_sprint: 'update-sprint/',
  POST_complete_sprint: 'complete-sprint/',
  DELETE_sprint: 'delete-sprint/',
  POST_add_work_item_to_sprint: 'add-work-item-to-sprint/',
  POST_remove_work_item_from_sprint: 'remove-work-item-from-sprint/',
  GET_sprint_work_items: 'get-sprint-work-items/',

  // Labels / versions / components
  POST_create_label: 'create-label/',
  GET_all_labels: 'get-all-labels/',
  DELETE_label: 'delete-label/',
  POST_create_project_version: 'create-project-version/',
  GET_all_project_versions: 'get-all-project-versions/',
  UPDATE_project_version: 'update-project-version/',
  DELETE_project_version: 'delete-project-version/',
  POST_create_component: 'create-component/',
  GET_all_components: 'get-all-components/',
  UPDATE_component: 'update-component/',
  DELETE_component: 'delete-component/',

  // Work item types / statuses / workflows
  POST_create_work_item_type: 'create-work-item-type/',
  GET_all_work_item_types: 'get-all-work-item-types/',
  UPDATE_work_item_type: 'update-work-item-type/',
  DELETE_work_item_type: 'delete-work-item-type/',
  POST_create_status: 'create-status/',
  GET_all_statuses: 'get-all-statuses/',
  GET_status_by_id: 'get-status-by-id/',
  UPDATE_status: 'update-status/',
  DELETE_status: 'delete-status/',
  POST_create_workflow: 'create-workflow/',
  GET_all_workflows: 'get-all-workflows/',
  UPDATE_workflow: 'update-workflow/',
  DELETE_workflow: 'delete-workflow/',
  POST_create_workflow_transition: 'create-workflow-transition/',
  GET_all_workflow_transitions: 'get-all-workflow-transitions/',
  DELETE_workflow_transition: 'delete-workflow-transition/',

  // Work items
  POST_create_work_item: 'create-work-item/',
  GET_all_work_items: 'get-all-work-items/',
  GET_work_item_by_id: 'get-work-item-by-id/',
  UPDATE_work_item: 'update-work-item/',
  POST_update_work_item_status: 'update-work-item-status/',
  POST_move_work_item: 'move-work-item/',
  DELETE_work_item: 'delete-work-item/',
  GET_board_work_items: 'get-board-work-items/',
  GET_assigned_to_me: 'get-assigned-to-me/',
  POST_create_work_item_relationship: 'create-work-item-relationship/',
  GET_work_item_relationships: 'get-work-item-relationships/',
  DELETE_work_item_relationship: 'delete-work-item-relationship/',

  // Worklogs / comments / attachments / activity
  POST_create_worklog: 'create-worklog/',
  GET_all_worklogs: 'get-all-worklogs/',
  UPDATE_worklog: 'update-worklog/',
  DELETE_worklog: 'delete-worklog/',
  POST_create_comment: 'create-comment/',
  GET_all_comments: 'get-all-comments/',
  UPDATE_comment: 'update-comment/',
  DELETE_comment: 'delete-comment/',
  POST_create_attachment: 'create-attachment/',
  GET_all_attachments: 'get-all-attachments/',
  DELETE_attachment: 'delete-attachment/',
  GET_activity_history: 'get-activity-history/',

  // Filters
  POST_create_saved_filter: 'create-saved-filter/',
  GET_all_saved_filters: 'get-all-saved-filters/',
  UPDATE_saved_filter: 'update-saved-filter/',
  DELETE_saved_filter: 'delete-saved-filter/',

  // Notifications
  POST_create_notification: 'create-notification/',
  GET_all_notifications: 'get-all-notifications/',
  POST_mark_notification_read: 'mark-notification-read/',
} as const
