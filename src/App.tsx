import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import ForYou from './pages/ForYou'
import Recent from './pages/Recent'
import Starred from './pages/Starred'
import Spaces from './pages/Spaces'
import Placeholder from './pages/Placeholder'
import SettingsLayout from './pages/settings/SettingsLayout'
import UsersPage from './pages/settings/UsersPage'
import InviteUsersPage from './pages/settings/InviteUsersPage'
import SettingsSection from './pages/settings/SettingsSection'
import WorkItemsSettings from './pages/settings/WorkItemsSettings'
import PersonalSettingsLayout from './pages/settings/PersonalSettingsLayout'
import GeneralSettings from './pages/settings/GeneralSettings'
import NotificationSettings from './pages/settings/NotificationSettings'
import DigestsSettings from './pages/settings/DigestsSettings'
import Dashboards from './pages/Dashboards'
import WorkItemDetail from './pages/WorkItemDetail'
import FilterSearch from './pages/filters/FilterSearch'
import FiltersList from './pages/filters/FiltersList'
import ProjectLayout from './pages/project/ProjectLayout'
import Summary from './pages/project/Summary'
import Timeline from './pages/project/Timeline'
import Backlog from './pages/project/Backlog'
import Board from './pages/project/Board'
import Calendar from './pages/project/Calendar'
import List from './pages/project/List'
import Forms from './pages/project/Forms'
import Goals from './pages/project/Goals'
import Development from './pages/project/Development'
import Worklog from './pages/project/Worklog'
import Reports from './pages/project/Reports'
import SpaceWorkTypes from './pages/settings/SpaceWorkTypes'
import MoveIssue from './pages/MoveIssue'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/for-you" replace />} />
          <Route path="for-you" element={<ForYou />} />
          <Route path="recent" element={<Recent />} />
          <Route path="starred" element={<Starred />} />
          <Route path="spaces" element={<Spaces />} />
          <Route path="projects/:key/settings/work-types" element={<SpaceWorkTypes />} />
          <Route path="projects/:key/settings" element={<Navigate to="work-types" replace />} />
          <Route path="spaces/:key/settings/work-types" element={<SpaceWorkTypes />} />
          <Route path="settings/work-types" element={<SpaceWorkTypes />} />
          <Route path="projects/:key" element={<ProjectLayout />}>
            <Route index element={<Navigate to="summary" replace />} />
            <Route path="summary" element={<Summary />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="backlog" element={<Backlog />} />
            <Route path="board" element={<Board />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="list" element={<List />} />
            <Route path="forms" element={<Forms />} />
            <Route path="goals" element={<Goals />} />
            <Route path="development" element={<Development />} />
            <Route path="worklog" element={<Worklog />} />
            <Route path="reports" element={<Reports />} />
          </Route>
          <Route path="browse/:id" element={<WorkItemDetail />} />
          <Route path="move/:id" element={<MoveIssue />} />
          <Route path="filters" element={<FiltersList />} />
          <Route path="filters/search" element={<FilterSearch />} />
          <Route path="filters/all" element={<FilterSearch />} />
          <Route path="dashboards" element={<Dashboards />} />
          <Route path="settings">
            <Route element={<PersonalSettingsLayout />}>
              <Route index element={<Navigate to="general" replace />} />
              <Route path="general" element={<GeneralSettings />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="digests" element={<DigestsSettings />} />
            </Route>
            <Route element={<SettingsLayout />}>
              <Route path="users" element={<UsersPage />} />
              <Route path="users/invite" element={<InviteUsersPage />} />
              <Route path="system" element={<SettingsSection title="System" description="Site-wide configuration, mail, and security. Requires GET/PATCH /admin/system." />} />
              <Route path="jira-apps" element={<SettingsSection title="Jira apps" description="Manage connected apps and application links. Requires GET/POST /admin/jira-apps." />} />
              <Route path="spaces" element={<SettingsSection title="Spaces" description="Space permission schemes, roles, and defaults. Requires GET/PATCH /admin/spaces/settings." />} />
              <Route path="work-items" element={<WorkItemsSettings />} />
              <Route path="marketplace" element={<SettingsSection title="Marketplace apps" description="Install and manage marketplace apps. Requires GET/POST /admin/marketplace." />} />
            </Route>
          </Route>
          <Route path="apps" element={<Placeholder title="Apps" description="Install and manage marketplace apps and integrations for your organization." />} />
          <Route path="plans" element={<Placeholder title="Plans" description="Cross-space roadmaps and capacity planning across teams." />} />
          <Route path="assets" element={<Placeholder title="Assets" description="Track hardware, software licences and other organizational assets." />} />
          <Route path="teams" element={<Placeholder title="Teams" description="Create teams, manage membership and see team workload." />} />
          <Route path="goals" element={<Placeholder title="Goals" description="Set organizational goals and connect them to work in your spaces." />} />
          <Route path="*" element={<Placeholder title="Page not found" description="The page you're looking for doesn't exist." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
