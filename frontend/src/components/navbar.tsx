import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="navigationbar">

      <div className="logo-container">
        <span>MEKAKEL</span>
      </div>

      <div className="navigationlinks">
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/how-it-works">How It Works</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </div>

    </nav>
  )
}

export default Navbar