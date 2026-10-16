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

import DonorProfilePage from './pages/donor/donor-profile'
import DonorAvailabilityPage from './pages/donor/donor-availability'
import DonorMedicalReportsPage from './pages/donor/donor-medical-reports'
import DonorHistoryPage from './pages/donor/donor-history'

import HospitalProfilePage from './pages/hospital/hospital-profile'
import HospitalStaffPage from './pages/hospital/hospital-staff'
import BloodInventoryPage from './pages/hospital/blood-inventory'

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