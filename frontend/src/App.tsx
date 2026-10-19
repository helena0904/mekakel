import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'

import Navbar from './components/navbar'
import Footer from './components/footer'

import Home from './pages/home'
import Login from './pages/login'
import Register from './pages/register'
import ForgotPassword from './pages/forgot-password'
import ResetPassword from './pages/reset-password'

import DonorDashboard from './pages/dashboard/donor-dashboard'
import HospitalDashboard from './pages/dashboard/hospital-dasboard'
import AdminDashboard from './pages/dashboard/admin-dashboard'
import DoctorDashboard from './pages/dashboard/doctor-dashboard'

import DonorProfilePage from './pages/donor/donor-profile'
import DonorAvailabilityPage from './pages/donor/donor-availability'
import DonorMedicalReportsPage from './pages/donor/donor-medical-reports'
import DonorHistoryPage from './pages/donor/donor-history'

import HospitalProfilePage from './pages/hospital/hospital-profile'
import HospitalStaffPage from './pages/hospital/hospital-staff'
import BloodInventoryPage from './pages/hospital/blood-inventory'

import HospitalApprovalsPage from './pages/admin/hospital-approvals'
import UserManagementPage from './pages/admin/user-management'
import AuditLogsPage from './pages/admin/audit-logs'

import VerificationQueuePage from './pages/doctor/verification-queue'
import ReviewMedicalReportPage from './pages/doctor/review-medical-report'

import RequestListPage from './pages/requests/request-list'
import CreateRequestPage from './pages/requests/create-request'
import RequestDetailsPage from './pages/requests/request-details'
import MatchingResultsPage from './pages/requests/matching-results'

import ReservationsPage from './pages/reservations/reservations'
import TransfersPage from './pages/transfers/transfers'
import TransferDetailsPage from './pages/transfers/transfer-details'

import NotificationsPage from './pages/notifications/notifications'

import ProtectedRoute from './routes/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/notifications"
            element={<NotificationsPage />}
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedAccountType="INDIVIDUAL" />
          }
        >
          <Route
            path="/donor-dashboard"
            element={<DonorDashboard />}
          />

          <Route
            path="/donor/profile"
            element={<DonorProfilePage />}
          />

          <Route
            path="/donor/availability"
            element={<DonorAvailabilityPage />}
          />

          <Route
            path="/donor/medical-reports"
            element={<DonorMedicalReportsPage />}
          />

          <Route
            path="/donor/history"
            element={<DonorHistoryPage />}
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedAccountType="HOSPITAL" />
          }
        >
          <Route
            path="/hospital-dashboard"
            element={<HospitalDashboard />}
          />

          <Route
            path="/hospital/profile"
            element={<HospitalProfilePage />}
          />

          <Route
            path="/hospital/staff"
            element={<HospitalStaffPage />}
          />

          <Route
            path="/hospital/inventory"
            element={<BloodInventoryPage />}
          />

          <Route
            path="/hospital/requests"
            element={<RequestListPage />}
          />

          <Route
            path="/hospital/requests/new"
            element={<CreateRequestPage />}
          />

          <Route
            path="/hospital/requests/:id"
            element={<RequestDetailsPage />}
          />

          <Route
            path="/hospital/requests/:id/matches"
            element={<MatchingResultsPage />}
          />

          <Route
            path="/hospital/reservations"
            element={<ReservationsPage />}
          />

          <Route
            path="/hospital/transfers"
            element={<TransfersPage />}
          />

          <Route
            path="/hospital/transfers/:id"
            element={<TransferDetailsPage />}
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={['ADMIN']} />
          }
        >
          <Route
            path="/admin-dashboard"
            element={<AdminDashboard />}
          />

          <Route
            path="/admin/hospitals"
            element={<HospitalApprovalsPage />}
          />

          <Route
            path="/admin/users"
            element={<UserManagementPage />}
          />

          <Route
            path="/admin/audit-logs"
            element={<AuditLogsPage />}
          />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={['DOCTOR']} />
          }
        >
          <Route
            path="/doctor-dashboard"
            element={<DoctorDashboard />}
          />

          <Route
            path="/doctor/verifications"
            element={<VerificationQueuePage />}
          />

          <Route
            path="/doctor/verifications/:id"
            element={<ReviewMedicalReportPage />}
          />
        </Route>

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>

      <Footer />
    </BrowserRouter>
  )
}

export default App