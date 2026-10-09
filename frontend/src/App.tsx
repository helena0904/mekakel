import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/navbar'
import Footer from './components/footer'
import Home from './pages/home'
import Login from './pages/login'
import Register from './pages/register'
import DonorDashboard from './pages/dashboard/donor-dashboard'
import HospitalDashboard from './pages/dashboard/hospital-dasboard'
import ProtectedRoute from './routes/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute allowedAccountType="INDIVIDUAL" />}>
          <Route
            path="/donor-dashboard"
            element={<DonorDashboard />}
          />
        </Route>

        <Route element={<ProtectedRoute allowedAccountType="HOSPITAL" />}>
          <Route
            path="/hospital-dashboard"
            element={<HospitalDashboard />}
          />
        </Route>
      </Routes>

      <Footer />
    </BrowserRouter>
  )
}

export default App