import AdminDashboard from './pages/AdminDashboard';
import AdminPermissions from './pages/AdminPermissions';
import Analytics from './pages/Analytics';
import Attendance from './pages/Attendance';
import BlockWardContract from './pages/BlockWardContract';
import BlockWards from './pages/BlockWards';
import BlockchainDocs from './pages/BlockchainDocs';
import ClassDetail from './pages/ClassDetail';
import Classes from './pages/Classes';
import GradeBook from './pages/GradeBook';
import Home from './pages/Home';
import IssuePoints from './pages/IssuePoints';
import ManageUsers from './pages/ManageUsers';
import Messages from './pages/Messages';
import MyPoints from './pages/MyPoints';
import Onboarding from './pages/Onboarding';
import ParentComms from './pages/ParentComms';
import PointCategories from './pages/PointCategories';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Resources from './pages/Resources';
import SchoolCodes from './pages/SchoolCodes';
import StudentDashboard from './pages/StudentDashboard';
import SystemSettings from './pages/SystemSettings';
import TeacherDashboard from './pages/TeacherDashboard';
import Timetable from './pages/Timetable';
import Web3BlockWards from './pages/Web3BlockWards';
import TeacherBlockWards from './pages/TeacherBlockWards';
import IssueBlockWard from './pages/IssueBlockWard';
import StudentBlockWards from './pages/StudentBlockWards';
import App from './pages/App';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "AdminPermissions": AdminPermissions,
    "Analytics": Analytics,
    "Attendance": Attendance,
    "BlockWardContract": BlockWardContract,
    "BlockWards": BlockWards,
    "BlockchainDocs": BlockchainDocs,
    "ClassDetail": ClassDetail,
    "Classes": Classes,
    "GradeBook": GradeBook,
    "Home": Home,
    "IssuePoints": IssuePoints,
    "ManageUsers": ManageUsers,
    "Messages": Messages,
    "MyPoints": MyPoints,
    "Onboarding": Onboarding,
    "ParentComms": ParentComms,
    "PointCategories": PointCategories,
    "Profile": Profile,
    "Reports": Reports,
    "Resources": Resources,
    "SchoolCodes": SchoolCodes,
    "StudentDashboard": StudentDashboard,
    "SystemSettings": SystemSettings,
    "TeacherDashboard": TeacherDashboard,
    "Timetable": Timetable,
    "Web3BlockWards": Web3BlockWards,
    "TeacherBlockWards": TeacherBlockWards,
    "IssueBlockWard": IssueBlockWard,
    "StudentBlockWards": StudentBlockWards,
    "App": App,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};