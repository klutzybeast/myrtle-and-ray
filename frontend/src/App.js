import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteProvider } from "@/lib/site";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyActionBar from "@/components/StickyActionBar";
import PopupSignup from "@/components/PopupSignup";

import Home from "@/pages/Home";
import Story from "@/pages/Story";
import Activities from "@/pages/Activities";
import ReadAloud from "@/pages/ReadAloud";
import Shop from "@/pages/Shop";
import ShopDetail from "@/pages/ShopDetail";
import Downloads from "@/pages/Downloads";
import DownloadDetail from "@/pages/DownloadDetail";
import ForCamps from "@/pages/ForCamps";
import About from "@/pages/About";
import Contact from "@/pages/Contact";

import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminCharacters from "@/pages/admin/AdminCharacters";
import AdminDownloads from "@/pages/admin/AdminDownloads";
import AdminDownloadCategories from "@/pages/admin/AdminDownloadCategories";
import AdminPages from "@/pages/admin/AdminPages";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminSubmissions from "@/pages/admin/AdminSubmissions";
import AdminMailingList from "@/pages/admin/AdminMailingList";
import AdminEmailOutbox from "@/pages/admin/AdminEmailOutbox";
import AdminMedia from "@/pages/admin/AdminMedia";
import AdminActivities from "@/pages/admin/AdminActivities";
import AdminCustomPages from "@/pages/admin/AdminCustomPages";
import AdminCustomPageEditor from "@/pages/admin/AdminCustomPageEditor";
import CustomPage from "@/pages/CustomPage";

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-[#6b7280]">Loading...</div>;
  if (!user || user.role !== "admin") return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />;
  return children;
}

function PublicShell({ children }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <StickyActionBar />
      <PopupSignup />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <SiteProvider>
            <Toaster position="top-center" richColors />
            <Routes>
              <Route path="/" element={<PublicShell><Home /></PublicShell>} />
              <Route path="/story" element={<PublicShell><Story /></PublicShell>} />
              <Route path="/activities" element={<PublicShell><Activities /></PublicShell>} />
              <Route path="/read-aloud" element={<PublicShell><ReadAloud /></PublicShell>} />
              <Route path="/shop" element={<PublicShell><Shop /></PublicShell>} />
              <Route path="/shop/:slug" element={<PublicShell><ShopDetail /></PublicShell>} />
              <Route path="/downloads" element={<PublicShell><Downloads /></PublicShell>} />
              <Route path="/downloads/:slug" element={<PublicShell><DownloadDetail /></PublicShell>} />
              <Route path="/for-camps" element={<PublicShell><ForCamps /></PublicShell>} />
              <Route path="/about" element={<PublicShell><About /></PublicShell>} />
              <Route path="/contact" element={<PublicShell><Contact /></PublicShell>} />
              <Route path="/p/:slug" element={<PublicShell><CustomPage /></PublicShell>} />

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                <Route index element={<AdminDashboard />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="characters" element={<AdminCharacters />} />
                <Route path="downloads" element={<AdminDownloads />} />
                <Route path="download-categories" element={<AdminDownloadCategories />} />
                <Route path="pages" element={<AdminPages />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="submissions" element={<AdminSubmissions />} />
                <Route path="mailing-list" element={<AdminMailingList />} />
                <Route path="email-outbox" element={<AdminEmailOutbox />} />
                <Route path="media" element={<AdminMedia />} />
                <Route path="activities" element={<AdminActivities />} />
                <Route path="custom-pages" element={<AdminCustomPages />} />
                <Route path="custom-pages/:slug" element={<AdminCustomPageEditor />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SiteProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
