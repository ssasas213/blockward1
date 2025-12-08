import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import BlockWards from './pages/BlockWards';
import IssuePoints from './pages/IssuePoints';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "Onboarding": Onboarding,
    "AdminDashboard": AdminDashboard,
    "TeacherDashboard": TeacherDashboard,
    "StudentDashboard": StudentDashboard,
    "Classes": Classes,
    "ClassDetail": ClassDetail,
    "BlockWards": BlockWards,
    "IssuePoints": IssuePoints,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};