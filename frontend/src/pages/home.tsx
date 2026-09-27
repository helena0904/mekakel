import { Link } from 'react-router-dom'
import heroimage from '../assets/hero.png'
function Home() {
    return (
 <div>
    <main>
 <section className="hero">
 <img src={heroimage} alt="Blood donation and healthcare" className="hero-image" />

 <div className="hero-content">
   <h1>Find Blood, Save Lives</h1>
 <p>  MEKAKEL connects hospitals, clinics, and verified volunteer donors to help find nearby blood resources when they are needed.</p>
                        
 <div className="hero-buttons">
  <Link to="/register"><button>Find Blood now</button></Link>
  <Link to="/login"><button>Become a Donor</button></Link>
  </div>
</div>
</section>


<section className="introduction" id="about">
 <h2>ABOUT US</h2>
<div className="about-container">
<p>MEKAKEL is a digital blood coordination platform designed to connect healthcare facilities with nearby blood resources and verified blood donors. It works as a bridge between doctors,
 hospitals, and donors, helping healthcare professionals findpotential blood resources nearby when blood is needed. Our goal is to make blood coordination faster and easier while helping
 verified donors take part in saving lives. MEKAKEL supports better coordination between hospitals, donors, and authorized healthcare professionals through a secure and organized system. We aim to reduce deaths caused by delays in blood coordination
 and make the process more accessible, reliable, and efficient.</p>
</div>

</section>

<section className="users">
<h2>WHO CAN USE MEKAKEL?</h2>
<div className="users-container">

<div className="user-card">
<h3>Donors</h3>
<p> Verified donors can create profiles, provide their blood information, and respond to blood requests.</p>
</div>

<div className="user-card">
<h3>Hospitals</h3>
<p>Hospitals can create blood requests and find available blood resources and verified donors. </p>
</div>

<div className="user-card">
<h3>Healthcare Professionals</h3>
<p> Authorized healthcare professionals can review requests and coordinate blood resources. </p>
</div>

<div className="user-card">
<h3>Blood Facilities</h3>
<p> Blood facilities can manage available blood resources and coordinate transfers when needed.</p>
</div>
</div>
 </section>


<section className="why-mekakel">
 <h2>WHY MEKAKEL?</h2>
<div className="why-container">
<div>
 <h3>Faster Coordination</h3>
 <p> Helps healthcare facilities find potential blood resources without relying only on phone calls and manual coordination.</p>
</div>

 <div>
<h3>Verified Information</h3>
 <p> Helps connect healthcare professionals with verified donors and organized blood-resource information.</p>
</div>

<div>
<h3>Better Communication</h3>
<p>Creates a central platform where hospitals,healthcare professionals, and donors can coordinate more easily.</p>
</div>
</div>
</section>

<section className="features" id="how-it-works">

    <h2>HOW IT WORKS</h2>

    <div className="how-container">

        <p>
           Our simple 5-step process makes blood coordination fast and reliable.</p>

        <h3>1. Hospital Creates a Request</h3>

        <p>
            A hospital or authorized healthcare professional submits a blood
            request with the required blood type, quantity, and location.
        </p>

        <h3>2. MEKAKEL Finds Nearby Resources</h3>

        <p>
            The system searches for available blood resources and verified
            donors near the requesting healthcare facility based on the
            request.
        </p>

        <h3>3. Doctor Reviews the Results</h3>

        <p>
            The healthcare professional reviews the available options and
            chooses the appropriate resource or donor to contact.
        </p>

        <h3>4. Donor Responds</h3>

        <p>
            If a donor is contacted, they can accept or decline the request.
            MEKAKEL does not automatically reserve blood or force a donor to
            participate.
        </p>

        <h3>5. Coordination Happens</h3>
 <p>
            The hospital, healthcare professional, and donor coordinate
            directly to arrange the next steps.
        </p>

        <p>
            MEKAKEL acts as a bridge for coordination. It does not test,
            collect, or provide blood. It helps connect healthcare
            professionals with nearby blood resources and verified donors
            when they are needed.
        </p>

    </div>

</section>


<section className="call-to-action">
<h2>Help Make Blood Coordination Easier</h2>
 <p> Whether you are a donor or a healthcare facility, MEKAKEL helps connect the right people and resources when they are needed.</p>

<div className="hero-buttons">

<button>join as a donor</button>

<button>Register Your Facility</button>
</div>
</section>
</main>

 </div>

)
}

export default Home