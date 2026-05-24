import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteProvider, useSite } from "@/lib/site";
import { AudioProvider } from "@/lib/audio";
import { CartProvider } from "@/lib/cart";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyActionBar from "@/components/StickyActionBar";
import PopupSignup from "@/components/PopupSignup";
import ChatBubble from "@/components/ChatBubble";
import CookieBanner from "@/components/CookieBanner";

import Home from "@/pages/Home";
import Story from "@/pages/Story";
import Activities from "@/pages/Activities";
import ReadAloud from "@/pages/ReadAloud";
import Shop from "@/pages/Shop";
import ShopDetail from "@/pages/ShopDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
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
import AdminCampaigns from "@/pages/admin/AdminCampaigns";
import AdminCampaignEditor from "@/pages/admin/AdminCampaignEditor";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminReadAloud from "@/pages/admin/AdminReadAloud";
import AdminDiscounts from "@/pages/admin/AdminDiscounts";
import AdminPenPals from "@/pages/admin/AdminPenPals";
import AdminColoring from "@/pages/admin/AdminColoring";
import AdminSeaStarStudio from "@/pages/admin/AdminSeaStarStudio";
import AdminStoryQuest from "@/pages/admin/AdminStoryQuest";
import AdminSingAlong from "@/pages/admin/AdminSingAlong";
import AdminPrintify from "@/pages/admin/AdminPrintify";
import AdminEtsy from "@/pages/admin/AdminEtsy";
import AdminThumbnails from "@/pages/admin/AdminThumbnails";
import PenPals from "@/pages/PenPals";
import Coloring from "@/pages/Coloring";
import SeaStarStudio from "@/pages/SeaStarStudio";
import StoryQuest from "@/pages/StoryQuest";
import SingAlong from "@/pages/SingAlong";
import CustomPage from "@/pages/CustomPage";
import WaveBadges from "@/pages/WaveBadges";
import MapPage from "@/pages/Map";

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-[#6b7280]">Loading...</div>;
  if (!user || user.role !== "admin") return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />;
  return children;
}

function AudioWrapper({ children }) {
  const site = useSite();
  const urls = Array.isArray(site?.ambient_audio_urls) && site.ambient_audio_urls.length
    ? site.ambient_audio_urls
    : (site?.ambient_audio_url ? [site.ambient_audio_url] : []);
  return <AudioProvider urls={urls}>{children}</AudioProvider>;
}

function PublicShell({ children }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <StickyActionBar />
      <PopupSignup />
      <ChatBubble />
      <CookieBanner />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <SiteProvider>
            <CartProvider>
            <AudioWrapper>
              <Toaster position="top-center" richColors />
              <Routes>
              <Route path="/" element={<PublicShell><Home /></PublicShell>} />
              <Route path="/story" element={<PublicShell><Story /></PublicShell>} />
              <Route path="/map" element={<PublicShell><MapPage /></PublicShell>} />
              <Route path="/activities" element={<PublicShell><Activities /></PublicShell>} />
              <Route path="/wave-badges" element={<PublicShell><WaveBadges /></PublicShell>} />
              <Route path="/read-aloud" element={<PublicShell><ReadAloud /></PublicShell>} />
              <Route path="/pen-pals" element={<PublicShell><PenPals /></PublicShell>} />
              <Route path="/coloring" element={<PublicShell><Coloring /></PublicShell>} />
              <Route path="/sea-star-studio" element={<PublicShell><SeaStarStudio /></PublicShell>} />
              <Route path="/story-quest" element={<PublicShell><StoryQuest /></PublicShell>} />
              <Route path="/story-quest/:slug" element={<PublicShell><StoryQuest /></PublicShell>} />
              <Route path="/sing-along" element={<PublicShell><SingAlong /></PublicShell>} />
              <Route path="/shop" element={<PublicShell><Shop /></PublicShell>} />
              <Route path="/shop/:slug" element={<PublicShell><ShopDetail /></PublicShell>} />
              <Route path="/cart" element={<PublicShell><Cart /></PublicShell>} />
              <Route path="/checkout" element={<PublicShell><Checkout /></PublicShell>} />
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
                <Route path="campaigns" element={<AdminCampaigns />} />
                <Route path="campaigns/:id" element={<AdminCampaignEditor />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="read-aloud" element={<AdminReadAloud />} />
                <Route path="discounts" element={<AdminDiscounts />} />
                <Route path="pen-pals" element={<AdminPenPals />} />
                <Route path="coloring" element={<AdminColoring />} />
                <Route path="sea-star-studio" element={<AdminSeaStarStudio />} />
                <Route path="story-quest" element={<AdminStoryQuest />} />
                <Route path="sing-along" element={<AdminSingAlong />} />
                <Route path="printify" element={<AdminPrintify />} />
                <Route path="etsy" element={<AdminEtsy />} />
                <Route path="thumbnails" element={<AdminThumbnails />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </AudioWrapper>
            </CartProvider>
          </SiteProvider>
        </AuthProvider>
      </BrowserRouter>
      </HelmetProvider>
    </div>
  );
}

export default App;
