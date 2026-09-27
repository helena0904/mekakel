import { Link } from 'react-router-dom'
import logo from '../assets/logo-placeholder.jpg'
function Navbar() {
    return (
        <nav className="navigationbar">

          <div className="logo-container">

    <img src={logo} alt="MEKAKEL logo" className="logo" />

    <span>MEKAKEL</span>

</div>

            <div className="navigationlinks">

                <Link to="/">Home</Link>

                <a href="#about">About</a>

                <a href="#how-it-works">How It Works</a>

                <Link to="/login">Login</Link>

                <Link to="/register">Register</Link>

            </div>

        </nav>
    )
}

export default Navbar