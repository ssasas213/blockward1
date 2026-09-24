import { lazy, Suspense } from 'react'
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
import SchoolPicker from './pages/SchoolPicker';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RecordDetail from './pages/RecordDetail';
import AdminApprovalPage from './pages/AdminApprovalPage';
import Records from './pages/Records';
import People from './pages/People';
import TeacherRecords from './pages/TeacherRecords';
import Verify from './pages/Verify';
import PublicPortfolio from './pages/PublicPortfolio';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { PlatformProvider } from '@/lib/PlatformContext';
import { SchoolProvider } from '@/lib/SchoolContext';
import SchoolSetup from './pages/SchoolSetup';
import JoinSchool from './pages/JoinSchool';
import StudentOnboarding from './pages/StudentOnboarding';
import OrgsLayout from '@/components/layouts/OrgsLayout';
import SchoolsSignup from './pages/schools/Signup';
import OrgsSignup from './pages/organisations/Signup';
import About from './pages/marketing/About';
import MarketingContact from './pages/marketing/Contact';
import Documentation from './pages/marketing/Documentation';
import Security from './pages/marketing/Security';
import Privacy from './pages/marketing/Privacy';
import Terms from './pages/marketing/Terms';
import OrgDashboard from './pages/organisations/Dashboard';
import Invitations from './pages/Invitations';
const StudentGrades = lazy(() => import('./pages/StudentGrades'));
import Gradebook from './pages/Gradebook';
const GradeManagement = lazy(() => import('./pages/GradeManagement'));
import AcademicSettings from './pages/AcademicSettings';
import Assignments from './pages/Assignments';
import Assemblies from './pages/Assemblies';
import SchoolCalendar from './pages/SchoolCalendar';
import AdminAttendance from './pages/AdminAttendance';
import JoinClass from './pages/JoinClass';
import StudentAttendance from './pages/StudentAttendance';
import PendingSignoffs from './pages/PendingSignoffs';
import MyTeaching from './pages/MyTeaching';
import StudentProgress from './pages/StudentProgress';
import ManageSchool from './pages/ManageSchool';
import Insights from './pages/Insights';
import SchoolSettings from './pages/SchoolSettings';
import MySchool from './pages/MySchool';
import ExternalVerify from './pages/ExternalVerify';
import GuardianConsent from './pages/GuardianConsent';
import ForOrganisations from './pages/ForOrganisations';
import DemoProfile from './pages/DemoProfile';
import TeamPage from './pages/TeamPage';
import TeamJoin from './pages/TeamJoin';
import HandleRoute from '@/components/HandleRoute';
import OrgPage from './pages/OrgPage';
import Opportunities from './pages/Opportunities';
import ManageOpportunities from './pages/ManageOpportunities';
import Feed from './pages/Feed';

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
      {/* Legacy onboarding URL — the flow now lives in /Signup */}
      <Route path="/Onboarding" element={<Navigate to="/Signup" replace />} />
      <Route path="/SchoolPicker" element={<ProtectedRoute><SchoolPicker /></ProtectedRoute>} />
      <Route path="/ForgotPassword" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/RecordDetail" element={<LayoutWrapper currentPageName="RecordDetail"><ProtectedRoute><RecordDetail /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/AdminApprovalQueue" element={<Navigate to="/Records" replace />} />
      <Route path="/admin/approve/:recordId" element={<LayoutWrapper currentPageName="AdminApprovalPage"><ProtectedRoute><AdminApprovalPage /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/AdminRecords" element={<Navigate to="/Records" replace />} />
      <Route path="/Records" element={<LayoutWrapper currentPageName="Records"><ProtectedRoute><Records /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/TeacherRecords" element={<LayoutWrapper currentPageName="TeacherRecords"><ProtectedRoute><TeacherRecords /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/People" element={<LayoutWrapper currentPageName="People"><ProtectedRoute><People /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/StudentMyRecords" element={<Navigate to="/StudentBlockWards" replace />} />
      <Route path="/StudentPortfolioVault" element={<Navigate to="/StudentBlockWards" replace />} />
      <Route path="/Verify" element={<LayoutWrapper currentPageName="Verify"><Verify /></LayoutWrapper>} />
      <Route path="/verify/:verification_id" element={<Verify />} />
      <Route path="/portfolio/:studentId" element={<PublicPortfolio />} />
      <Route path="/CustodianDashboard" element={<Navigate to="/Records" replace />} />
      <Route path="/SchoolSetup" element={<SchoolSetup />} />
      <Route path="/JoinClass" element={<JoinClass />} />
      <Route path="/JoinSchool" element={<JoinSchool />} />
      <Route path="/StudentOnboarding" element={<StudentOnboarding />} />
      <Route path="/invite/:token" element={<Signup />} />
      <Route path="/Invitations" element={<LayoutWrapper currentPageName="Invitations"><ProtectedRoute><Invitations /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/StudentGrades" element={<LayoutWrapper currentPageName="StudentGrades"><ProtectedRoute><StudentGrades /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Gradebook" element={<LayoutWrapper currentPageName="Gradebook"><ProtectedRoute><Gradebook /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/GradeManagement" element={<LayoutWrapper currentPageName="GradeManagement"><ProtectedRoute><GradeManagement /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/AcademicSettings" element={<LayoutWrapper currentPageName="AcademicSettings"><ProtectedRoute><AcademicSettings /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Assignments" element={<LayoutWrapper currentPageName="Assignments"><ProtectedRoute><Assignments /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Assemblies" element={<LayoutWrapper currentPageName="Assemblies"><ProtectedRoute><Assemblies /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/SchoolCalendar" element={<LayoutWrapper currentPageName="SchoolCalendar"><ProtectedRoute><SchoolCalendar /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/AdminAttendance" element={<LayoutWrapper currentPageName="AdminAttendance"><ProtectedRoute><AdminAttendance /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/StudentAttendance" element={<LayoutWrapper currentPageName="StudentAttendance"><ProtectedRoute><StudentAttendance /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/AchievementRequests" element={<Navigate to="/StudentBlockWards" replace />} />
      <Route path="/PendingSignoffs" element={<LayoutWrapper currentPageName="PendingSignoffs"><ProtectedRoute><PendingSignoffs /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/MyTeaching" element={<LayoutWrapper currentPageName="MyTeaching"><ProtectedRoute><MyTeaching /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/StudentProgress" element={<LayoutWrapper currentPageName="StudentProgress"><ProtectedRoute><StudentProgress /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/ManageSchool" element={<LayoutWrapper currentPageName="ManageSchool"><ProtectedRoute><ManageSchool /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Insights" element={<LayoutWrapper currentPageName="Insights"><ProtectedRoute><Insights /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/SchoolSettings" element={<LayoutWrapper currentPageName="SchoolSettings"><ProtectedRoute><SchoolSettings /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/MySchool" element={<LayoutWrapper currentPageName="MySchool"><ProtectedRoute><MySchool /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/TeacherBlockWards" element={<Navigate to="/TeacherRecords" replace />} />
      <Route path="/GradeBook" element={<Navigate to="/Gradebook" replace />} />
      <Route path="/external-verify/:token" element={<ExternalVerify />} />
      <Route path="/guardian-consent/:token" element={<GuardianConsent />} />
      <Route path="/team/:slug" element={<TeamPage />} />
      <Route path="/team-join/:token" element={<TeamJoin />} />

      <Route path="/org/:slug" element={<OrgPage />} />
      <Route path="/Opportunities" element={<LayoutWrapper currentPageName="Opportunities"><ProtectedRoute><Opportunities /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/ManageOpportunities" element={<LayoutWrapper currentPageName="ManageOpportunities"><ProtectedRoute><ManageOpportunities /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Feed" element={<LayoutWrapper currentPageName="Feed"><ProtectedRoute><Feed /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/ForOrganisations" element={<ForOrganisations />} />
      <Route path="/DemoProfile" element={<DemoProfile />} />

      {/* Platform-specific login/signup routes — /schools/login and
          /organisations/login are the canonical STAFF entry (same shared
          auth system as /Login, with explicit school-workspace context). */}
      <Route path="/schools/login" element={<Login staffEntry />} />
      <Route path="/schools/signup" element={<SchoolsSignup />} />
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