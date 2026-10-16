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