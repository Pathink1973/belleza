import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { RegisterClient } from './pages/auth/RegisterClient';
import { RegisterProfessional } from './pages/auth/RegisterProfessional';
import { AccountTypeSelection } from './pages/auth/AccountTypeSelection';
import { AdminLogin } from './pages/auth/AdminLogin';
import { SuperAdminBootstrap } from './pages/auth/SuperAdminBootstrap';
import { Layout } from './components/Layout';
import { AuthGuard } from './components/AuthGuard';
import { SuperAdminGuard } from './components/SuperAdminGuard';
import { ScrollToTop } from './components/ScrollToTop';
import { Profile } from './pages/Profile';
import { Services } from './pages/Services';
import { ServiceDetails } from './pages/ServiceDetails';
import { Dashboard } from './pages/Dashboard';
import { LandingPage } from './pages/LandingPage';
import { Categories } from './pages/Categories';
import { ServiceForm } from './pages/services/ServiceForm';
import { BookingForm } from './pages/bookings/BookingForm';
import { Bookings } from './pages/Bookings';
import { Calendar } from './pages/Calendar';
import { ProfessionalDashboard } from './pages/professional/Dashboard';
import { ClientList } from './pages/professional/ClientList';
import { Availability } from './pages/professional/Availability';
import { BlockedDates } from './pages/professional/BlockedDates';
import { BlockedTimeSlots } from './pages/professional/BlockedTimeSlots';
import { InternalBookingForm } from './pages/professional/InternalBookingForm';
import { BlockManagement } from './pages/professional/BlockManagement';
import { SuperAdminDashboard } from './pages/admin/SuperAdminDashboard';
import { SuperAdminEmails } from './pages/admin/SuperAdminEmails';
import { Reviews } from './pages/Reviews';
import { Notifications } from './pages/Notifications';
import { ServiceModifications } from './pages/professional/ServiceModifications';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { Features } from './pages/Features';
import { Help } from './pages/Help';
import { Terms } from './pages/Terms';
import { Cookies } from './pages/Cookies';
import { useAuthStore } from './store/authStore';

function App() {
  const { user, loading, initialized, initialize } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error('App initialization error:', error);
      }
    };

    if (isMounted) {
      initializeAuth();
    }

    return () => {
      isMounted = false;
    };
  }, [initialize]);

  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<AccountTypeSelection />} />
        <Route path="/auth/register-client" element={<RegisterClient />} />
        <Route path="/auth/register-professional" element={<RegisterProfessional />} />
        <Route path="/auth/admin-login" element={<AdminLogin />} />
        <Route path="/auth/super-admin-bootstrap" element={<SuperAdminBootstrap />} />

        {/* Public Routes - No authentication required */}
        <Route
          path="/"
          element={<LandingPage />}
        />
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />


        {/* Public Service Routes */}
        <Route
          path="/categories"
          element={<Categories />}
        />
        <Route
          path="/services"
          element={
            <Layout>
              <Services />
            </Layout>
          }
        />
        <Route
          path="/services/:id"
          element={
            <Layout>
              <ServiceDetails />
            </Layout>
          }
        />
        <Route
          path="/booking"
          element={
            <Layout>
              <BookingForm />
            </Layout>
          }
        />

        {/* Informational Pages */}
        <Route
          path="/about"
          element={
            <Layout>
              <About />
            </Layout>
          }
        />
        <Route
          path="/contact"
          element={
            <Layout>
              <Contact />
            </Layout>
          }
        />
        <Route
          path="/features"
          element={
            <Layout>
              <Features />
            </Layout>
          }
        />
        <Route
          path="/help"
          element={
            <Layout>
              <Help />
            </Layout>
          }
        />
        <Route
          path="/terms"
          element={
            <Layout>
              <Terms />
            </Layout>
          }
        />
        <Route
          path="/cookies"
          element={
            <Layout>
              <Cookies />
            </Layout>
          }
        />

        {/* Professional Routes */}
        <Route
          path="/professional"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Navigate to="/professional/dashboard" replace />
            </AuthGuard>
          }
        />
        <Route
          path="/professional/dashboard"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <ProfessionalDashboard />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/calendar"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <Calendar />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/services"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <Services />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/services/new"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <ServiceForm />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/services/:id/edit"
          element={
            <AuthGuard allowedRoles={['professional', 'super_admin']}>
              <Layout>
                <ServiceForm />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/bookings"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <Bookings />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/bookings/new"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <InternalBookingForm />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/clients"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <ClientList />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/availability"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <Availability />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/blocked-dates"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <BlockedDates />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/blocked-time-slots"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <BlockedTimeSlots />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/blocks"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <BlockManagement />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/reviews"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <Reviews />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/professional/service-modifications"
          element={
            <AuthGuard allowedRoles={['professional']}>
              <Layout>
                <ServiceModifications />
              </Layout>
            </AuthGuard>
          }
        />

        {/* Super Admin Routes */}
        <Route
          path="/super-admin"
          element={
            <SuperAdminGuard>
              <Navigate to="/super-admin/dashboard" replace />
            </SuperAdminGuard>
          }
        />
        <Route
          path="/super-admin/dashboard"
          element={
            <SuperAdminGuard>
              <Layout>
                <SuperAdminDashboard />
              </Layout>
            </SuperAdminGuard>
          }
        />
        <Route
          path="/super-admin/emails"
          element={
            <SuperAdminGuard>
              <Layout>
                <SuperAdminEmails />
              </Layout>
            </SuperAdminGuard>
          }
        />

        {/* Shared Routes */}
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <Layout>
                <Profile />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/reviews"
          element={
            <AuthGuard>
              <Layout>
                <Reviews />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/notifications"
          element={
            <AuthGuard>
              <Layout>
                <Notifications />
              </Layout>
            </AuthGuard>
          }
        />
        <Route
          path="/bookings"
          element={
            <AuthGuard>
              <Layout>
                <Bookings />
              </Layout>
            </AuthGuard>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;