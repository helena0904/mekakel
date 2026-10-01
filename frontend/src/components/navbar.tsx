import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/logo-placeholder.jpg'

function Navbar() {
    const navigate = useNavigate()

    const goToSection = (section: string) => {
        navigate('/')

        setTimeout(() => {
            const element = document.getElementById(section)

            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth'
                })
            }
        }, 100)
    }

    return (
        <nav className="navigationbar">

            <div className="logo-container">

                <img src={logo} alt="MEKAKEL logo" className="logo" />

                <span>MEKAKEL</span>

            </div>

            <div className="navigationlinks">

                <Link to="/">Home</Link>

                <button onClick={() => goToSection('about')}>
                    About
                </button>

                <button onClick={() => goToSection('how-it-works')}>
                    How It Works
                </button>

                <Link to="/login">Login</Link>

                <Link to="/register">Register</Link>

            </div>

        </nav>
    )
}

export default Navbar