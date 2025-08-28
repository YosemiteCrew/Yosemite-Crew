"use client";
import Image from 'next/image'
import Link from 'next/link'
import React, { useRef } from 'react'
import "./Footer.css"
import { Container } from 'react-bootstrap'
import { motion, Variants, useInView } from 'framer-motion'

const footerLinks = [
  {
    title: "Developers",
    links: [
      { label: "Getting Started", href: "#" },
      { label: "Documentation", href: "#" },
      { label: "Search", href: "#" }
    ]
  },
  {
    title: "Community",
    links: [
      // { label: "Case Studies", href: "#" },
      { label: "Discord", href: "#" },
      // { label: "Storybook", href: "#" },
      { label: "GitHub", href: "#" },
      // { label: "Contributing", href: "#" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about_us" },
      // { label: "Security", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "/privacypolicy" },
      { label: "Pricing", href: "/pricing" },
      // { label: "Enterprise", href: "#" },
      // { label: "Careers", href: "#" },
      { label: "Blog", href: "/blogpage" }
    ]
  }
];

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18
    }
  }
};

const ftDivVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

function Footer() {
  const footerRef = useRef(null)
  const inView = useInView(footerRef, { once: true, margin: '-100px' })

  return (
    <motion.footer
      ref={footerRef}
      className="Footersec"
      role="contentinfo"
      aria-label="Site Footer"
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <Container>
        <div className="FooterData">
          <div className="FootTopData">
            <div className="leftFooter">
              <Image aria-hidden src="/Images/Ftlogo.png" alt="Yosemite Crew Logo" width={96} height={96} />
              <div className="ClientLogo" aria-label="Certifications">
                <Image aria-hidden src="/Images/ftlog1.png" alt="GDPR" width={55} height={56} />
                <Image aria-hidden src="/Images/ftlog2.png" alt="SOC2" width={56} height={56} />
                <Image aria-hidden src="/Images/ftlog3.png" alt="HL7 FHIR" width={54} height={60} />
                <Image aria-hidden src="/Images/ftlog4.png" alt="ISO 27001" width={117} height={28} />
              </div>
            </div>
            <motion.nav
              className="RytFooter"
              aria-label="Footer Navigation"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {footerLinks.map((section) => (
                <motion.div
                  className="FtDiv"
                  key={section.title}
                  variants={ftDivVariants}
                >
                  <h5>{section.title}</h5>
                  <ul className="FtLinks" role="list">
                    {section.links.map(link => (
                      <li key={link.label}>
                        <Link href={link.href}>{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.nav>
          </div>
          {/* <hr className="footer-divider" aria-hidden="true" /> */}
          <div className="Footer_Bottom">
            <div className="Bootom_Foot">
              <h4>Copyright &copy; 2025 DuneXploration</h4>
              <p>
                DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127 Mainz<br />
                email: <a href="mailto:support@yosemitecrew.com">support@yosemitecrew.com</a>, phone: <a href="tel:+4915227763275">+49 152 277 63275</a>
              </p>
              <p>
                Geschaftsfuhrer: Ankit Upadhyay Amtsgerichts Mainz unter HRB 52778, VAT: DE367920596
              </p>
            </div>
          </div>
        </div>
      </Container>
    </motion.footer>
  )
}

export default Footer