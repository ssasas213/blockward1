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

// Explicit imports for pages that must always be routable (not relying on pagesConfig loop)
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RecordDetail from './pages/RecordDetail';
import AdminApprovalQueue from './pages/AdminApprovalQueue';
import AdminApprovalPage from './pages/AdminApprovalPage';
import AdminRecords from './pages/AdminRecords';
import TeacherRecords from './pages/TeacherRecords';
import StudentMyRecords from './pages/StudentMyRecords';
import StudentPortfolioVault from './pages/StudentPortfolioVault';
import Verify from './pages/Verify';
import PublicPortfolio from './pages/PublicPortfolio';
import CustodianDashboard from './pages/CustodianDashboard';
import ChoosePlatform from './pages/ChoosePlatform';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { PlatformProvider } from '@/lib/PlatformContext';
import { SchoolProvider } from '@/lib/SchoolContext';
import SchoolSetup from './pages/SchoolSetup';
import JoinSchool from './pages/JoinSchool';
import StudentOnboarding from './pages/StudentOnboarding';
import OrgsLayout from '@/components/layouts/OrgsLayout';
import SchoolsLogin from './pages/schools/Login';
import SchoolsSignup from './pages/schools/Signup';
import OrgsLogin from './pages/organisations/Login';
import OrgsSignup from './pages/organisations/Signup';
import OrgDashboard from './pages/organisations/Dashboard';
import AcceptInvite from './pages/AcceptInvite';
import Invitations from './pages/Invitations';

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
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
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
      <Route path="/ForgotPassword" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/RecordDetail" element={<LayoutWrapper currentPageName="RecordDetail"><ProtectedRoute><RecordDetail /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/AdminApprovalQueue" element={<LayoutWrapper currentPageName="AdminApprovalQueue"><ProtectedRoute><AdminApprovalQueue /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/admin/approve/:recordId" element={<LayoutWrapper currentPageName="AdminApprovalPage"><ProtectedRoute><AdminApprovalPage /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/AdminRecords" element={<LayoutWrapper currentPageName="AdminRecords"><ProtectedRoute><AdminRecords /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/TeacherRecords" element={<LayoutWrapper currentPageName="TeacherRecords"><ProtectedRoute><TeacherRecords /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/StudentMyRecords" element={<LayoutWrapper currentPageName="StudentMyRecords"><ProtectedRoute><StudentMyRecords /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/StudentPortfolioVault" element={<LayoutWrapper currentPageName="StudentPortfolioVault"><ProtectedRoute><StudentPortfolioVault /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/Verify" element={<LayoutWrapper currentPageName="Verify"><Verify /></LayoutWrapper>} />
      <Route path="/verify/:verification_id" element={<Verify />} />
      <Route path="/portfolio/:studentId" element={<PublicPortfolio />} />
      <Route path="/CustodianDashboard" element={<LayoutWrapper currentPageName="CustodianDashboard"><ProtectedRoute><CustodianDashboard /></ProtectedRoute></LayoutWrapper>} />
      <Route path="/ChoosePlatform" element={<ChoosePlatform />} />
      <Route path="/SchoolSetup" element={<SchoolSetup />} />
      <Route path="/JoinSchool" element={<JoinSchool />} />
      <Route path="/StudentOnboarding" element={<StudentOnboarding />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/Invitations" element={<LayoutWrapper currentPageName="Invitations"><ProtectedRoute><Invitations /></ProtectedRoute></LayoutWrapper>} />

      {/* Platform-specific login/signup routes */}
      <Route path="/schools/login" element={<SchoolsLogin />} />
      <Route path="/schools/signup" element={<SchoolsSignup />} />
      <Route path="/organisations/login" element={<OrgsLogin />} />
      <Route path="/organisations/signup" element={<OrgsSignup />} />

      {/* Organisations platform — scoped routes with org layout */}
      <Route path="/organisations" element={<ProtectedRoute><OrgsLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/organisations/dashboard" replace />} />
        <Route path="dashboard" element={<OrgDashboard />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
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