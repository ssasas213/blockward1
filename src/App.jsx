import { Suspense } from 'react'
import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLoadingGate from '@/components/auth/AppLoadingGate';

// Explicit imports for pages that must always be routable (not relying on pagesConfig loop)
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthLoopError from './pages/AuthLoopError';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RecordDetail from './pages/RecordDetail';
import AdminApprovalPage from './pages/AdminApprovalPage';
import Records from './pages/Records';
import People from './pages/People';
import TeacherRecords from './pages/TeacherRecords';
import PendingSignoffs from './pages/PendingSignoffs';
import Verify from './pages/Verify';
import PublicPortfolio from './pages/PublicPortfolio';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { PlatformProvider } from '@/lib/PlatformContext';
import { SchoolProvider } from '@/lib/SchoolContext';

import OrgsLayout from '@/components/layouts/OrgsLayout';
import OrgsSignup from './pages/organisations/Signup';
import Register from './pages/organisations/Register';
import About from './pages/marketing/About';
import MarketingContact from './pages/marketing/Contact';
import Documentation from './pages/marketing/Documentation';
import Security from './pages/marketing/Security';
import Privacy from './pages/marketing/Privacy';
import Terms from './pages/marketing/Terms';
import OrgDashboard from './pages/organisations/Dashboard';
import Invitations from './pages/Invitations';
import ExternalVerify from './pages/ExternalVerify';
import GuardianConsent from './pages/GuardianConsent';
import ForOrganisations from './pages/ForOrganisations';
import DemoProfile from './pages/DemoProfile';
import SampleVerification from './pages/SampleVerification';
import RoleDashboardRedirect from '@/components/auth/RoleDashboardRedirect';
import TeamPage from './pages/TeamPage';
import TeamJoin from './pages/TeamJoin';
import HandleRoute from '@/components/HandleRoute';
import OrgPage from './pages/OrgPage';
import OrgInviteAccept from './pages/OrgInviteAccept';
import Opportunities from './pages/Opportunities';
import ManageOpportunities from './pages/ManageOpportunities';
import Feed from './pages/Feed';
// Role dashboards — landing pages for the Holder / Verifier / Organisation
// Owner personas. The role MODEL is Holder/Verifier/Org Owner/Internal Admin
// (see Layout.jsx ROLE_LABELS); these pages are the per-persona dashboards.
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import StudentBlockWards from './pages/StudentBlockWards';
import MyAchievements from './pages/MyAchievements';
import AdminConsole from './pages/internal/AdminConsole';
import RouteSeo from '@/components/RouteSeo';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <AppLoadingGate />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<AppLoadingGate timeoutMs={20000} message="Loading page…" />}>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      {/* Explicit routes for critical pages — guaranteed to resolve regardless of pagesConfig loop */}
      <Route path="/Login" element={<Login />} />
      <Route path="/Signup" element={<Signup />} />
      <Route path="/AuthLoopError" element={<AuthLoopError />} />
      {/* Legacy onboarding URL — the flow now lives in / Signup (global Blockward onboarding) */}
      <Route path="/Onboarding" element={<Navigate to="/Signup" replace />} />
      {/* Legacy school setup / join URLs — redirect to the organisation flow */}
      <Route path="/SchoolSetup" element={<Navigate to="/register-organisation" replace />} />
      <Route path="/JoinSchool" element={<Navigate to="/organisation" replace />} />
      <Route path="/ForgotPassword" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/RecordDetail" element={<LayoutWrapper currentPageName="RecordDetail"><ProtectedRoute><RecordDetail /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/admin/approve/:recordId" element={<LayoutWrapper currentPageName="AdminApprovalPage"><ProtectedRoute><AdminApprovalPage /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Records" element={<LayoutWrapper currentPageName="Records"><ProtectedRoute><Records /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/TeacherRecords" element={<LayoutWrapper currentPageName="TeacherRecords"><ProtectedRoute><TeacherRecords /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/People" element={<LayoutWrapper currentPageName="People"><ProtectedRoute><People /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Verify" element={<LayoutWrapper currentPageName="Verify"><Verify /></LayoutWrapper>} />
      {/* Sample verification page for the example profile — clearly labelled, never a real credential */}
      <Route path="/verify/demo" element={<SampleVerification />} />
      <Route path="/verify/:verification_id" element={<Verify />} />
      <Route path="/portfolio/:studentId" element={<PublicPortfolio />} />
      <Route path="/invite/:token" element={<Signup />} />
      <Route path="/Invitations" element={<LayoutWrapper currentPageName="Invitations"><ProtectedRoute><Invitations /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/PendingSignoffs" element={<LayoutWrapper currentPageName="PendingSignoffs"><ProtectedRoute><PendingSignoffs /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/external-verify/:token" element={<ExternalVerify />} />
      <Route path="/guardian-consent/:token" element={<GuardianConsent />} />
      <Route path="/team/:slug" element={<TeamPage />} />
      <Route path="/team-join/:token" element={<TeamJoin />} />

      <Route path="/org/:slug" element={<OrgPage />} />
      <Route path="/organisation" element={<OrgInviteAccept />} />
      <Route path="/Opportunities" element={<LayoutWrapper currentPageName="Opportunities"><ProtectedRoute><Opportunities /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/ManageOpportunities" element={<LayoutWrapper currentPageName="ManageOpportunities"><ProtectedRoute><ManageOpportunities /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Feed" element={<LayoutWrapper currentPageName="Feed"><ProtectedRoute><Feed /></ProtectedRoute></LayoutWrapper>} />
      {/* Role dashboards — per-persona landing pages (Holder / Verifier / Org Owner) */}
      <Route path="/StudentDashboard" element={<LayoutWrapper currentPageName="StudentDashboard"><ProtectedRoute><StudentDashboard /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/TeacherDashboard" element={<LayoutWrapper currentPageName="TeacherDashboard"><ProtectedRoute><TeacherDashboard /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/AdminDashboard" element={<LayoutWrapper currentPageName="AdminDashboard"><ProtectedRoute><AdminDashboard /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Profile" element={<LayoutWrapper currentPageName="Profile"><ProtectedRoute><Profile /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/StudentBlockWards" element={<LayoutWrapper currentPageName="StudentBlockWards"><ProtectedRoute><StudentBlockWards /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Achievements" element={<LayoutWrapper currentPageName="Achievements"><ProtectedRoute><MyAchievements /></ProtectedRoute></LayoutWrapper>} />
      {/* Blockward staff internal tools — role re-checked server-side */}
      <Route path="/internal" element={<Navigate to="/internal/admin" replace />} />
      <Route path="/internal/admin" element={<AdminConsole />} />
      <Route path="/admin/organisations" element={<Navigate to="/internal/admin" replace />} />
      {/* Issuer organisation registration — persistent IssuerOrganisation record */}
      <Route path="/register-organisation" element={<Register />} />
      <Route path="/ForOrganisations" element={<ForOrganisations />} />
      <Route path="/DemoProfile" element={<DemoProfile />} />
      {/* BlockWard AI is hidden during beta — any link to it lands on the
          user's own dashboard instead of a 404. Restore the original page
          element to re-enable. */}
      <Route path="/BlockWardAI" element={<RoleDashboardRedirect />} />

      {/* Platform-specific login/signup routes — /schools/login and
          /organisations/login are the canonical STAFF entry (same shared
          auth system as /Login, with explicit school-workspace context). */}
      <Route path="/schools/login" element={<Login staffEntry />} />
      <Route path="/schools/signup" element={<Navigate to="/organisations/signup" replace />} />
      <Route path="/organisations/login" element={<Login staffEntry />} />
      <Route path="/organisations/signup" element={<OrgsSignup />} />
      <Route path="/orgs/login" element={<Navigate to="/schools/login" replace />} />

      {/* Public marketing pages */}
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<MarketingContact />} />
      <Route path="/documentation" element={<Documentation />} />
      <Route path="/security" element={<Security />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* Organisations platform — scoped routes with org layout */}
      <Route path="/organisations" element={<ProtectedRoute><OrgsLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/organisations/dashboard" replace />} />
        <Route path="dashboard" element={<OrgDashboard />} />
      </Route>

      {/* Public /@handle profiles — a FULL-SEGMENT dynamic route (a literal
          "@" prefix inside a segment never matches in React Router v6).
          HandleRoute splits the "@handle" segment and renders the public
          profile, or 404s for non-@ single-segment paths. Static routes rank
          above dynamic ones, so every declared page still wins. */}
      <Route path="/:handleSegment" element={<HandleRoute />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <PlatformProvider>
          <SchoolProvider>
          <Router>
            <NavigationTracker />
            <RouteSeo />
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SonnerToaster />
          <VisualEditAgent />
          </SchoolProvider>
        </PlatformProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App