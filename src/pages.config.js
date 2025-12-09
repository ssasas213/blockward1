import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import BlockWards from './pages/BlockWards';
import IssuePoints from './pages/IssuePoints';
import Timetable from './pages/Timetable';
import Resources from './pages/Resources';
import ManageUsers from './pages/ManageUsers';
import MyPoints from './pages/MyPoints';
import PointCategories from './pages/PointCategories';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import SchoolCodes from './pages/SchoolCodes';
import ParentComms from './pages/ParentComms';
import BlockchainDocs from './pages/BlockchainDocs';
import BlockWardContract from './pages/BlockWardContract';
import AdminPermissions from './pages/AdminPermissions';
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
    "Timetable": Timetable,
    "Resources": Resources,
    "ManageUsers": ManageUsers,
    "MyPoints": MyPoints,
    "PointCategories": PointCategories,
    "Profile": Profile,
    "Reports": Reports,
    "SchoolCodes": SchoolCodes,
    "ParentComms": ParentComms,
    "BlockchainDocs": BlockchainDocs,
    "BlockWardContract": BlockWardContract,
    "AdminPermissions": AdminPermissions,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};