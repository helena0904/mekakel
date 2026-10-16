function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <p>
        © {currentYear} MEKAKEL. All rights reserved.
      </p>
    </footer>
  )
}

export default Footer