import { useEffect } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { dashboardPathFor } from '../utils/dashboard'
import logo from '../assets/logo-placeholder.jpg'

function Navbar() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isAuthenticated = Boolean(user && token)

  const dashboardPath = user
    ? dashboardPathFor(user.accountType)
    : '/login'

  useEffect(() => {
    if (location.pathname !== '/' || !location.hash) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const sectionId = location.hash.slice(1)
      const element = document.getElementById(sectionId)

      element?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [location.pathname, location.hash, location.key])

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <nav
      className="navigationbar"
      aria-label="Main navigation"
    >
      <Link
        to="/"
        className="logo-container"
        style={{
          color: 'inherit',
          textDecoration: 'none',
        }}
      >
        <img
          src={logo}
          alt="Mekakel logo"
          className="logo"
        />

        <span>MEKAKEL</span>
      </Link>

      <div className="navigationlinks">
        <Link to="/">Home</Link>

        <Link to="/#about">
          About
        </Link>

        <Link to="/#how-it-works">
          How It Works
        </Link>

        {isAuthenticated ? (
          <>
            <Link to={dashboardPath}>
              Dashboard
            </Link>

            <Link to="/notifications">
              Notifications
            </Link>

            <button
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">
              Login
            </Link>

            <Link to="/register">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar