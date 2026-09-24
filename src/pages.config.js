/**
 * pages.config.js - Page routing configuration
 *
 * Explicit routing only: every route lives in src/App.jsx as an explicit
 * <Route>. The Pages map below is intentionally minimal — the marketing and
 * app pages are routed (and protected) explicitly so that private pages are
 * never auto-exposed to crawlers or the sitemap.
 */
import Home from './pages/Home';
import __Layout from './Layout.jsx';

export const PAGES = {
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};