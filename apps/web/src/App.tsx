import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getAccessToken } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { AuthPage } from '@/features/auth/AuthPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AssistantPage } from '@/features/ai-chat/AssistantPage';
import { AgentConsolePage } from '@/features/agent-console/AgentConsolePage';
import { CodeStudioPage } from '@/features/studio/CodeStudioPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { DebugPage } from '@/features/debug/DebugPage';
import { SecurityPage } from '@/features/security/SecurityPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { TestingPage } from '@/features/testing/TestingPage';
import { GitHubPage } from '@/features/github/GitHubPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

function Protected({ children }: { children: ReactNode }) {
  return getAccessToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="agents" element={<AgentConsolePage />} />
        <Route path="studio" element={<CodeStudioPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="debug" element={<DebugPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="reviews" element={<ReviewPage />} />
        <Route path="testing" element={<TestingPage />} />
        <Route path="github" element={<GitHubPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
