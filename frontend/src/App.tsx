import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/navbar'
import Footer from './components/footer'
import Home from './pages/home'
import Login from './pages/login'
import Register from './pages/register'

function App() {
  return (
    <BrowserRouter>

      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>

      <Footer />

    </BrowserRouter>
  )
}

export default App