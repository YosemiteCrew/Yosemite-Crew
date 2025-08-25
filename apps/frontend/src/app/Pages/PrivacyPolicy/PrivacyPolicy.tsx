import React from 'react'
import "./PrivacyPolicy.css"
import { Container } from 'react-bootstrap'
import Link from 'next/link'
import { Icon } from '@iconify/react/dist/iconify.js'

function PrivacyPolicy() {
  return (
    <>
    <section className='PrivacyPolicySec'>
        <Container>
            <div className="PrivacyPolicyData">
                <div className="privacyHead">
                    <div className="privacyhead">
                        <Link href=""><Icon icon="solar:round-arrow-up-bold" width="24" height="24" /></Link>
                        <h2>Privacy Policy</h2>
                    </div>
                    <p>The protection and security of your personal information is important to us. This privacy policy describes how we collect, process, and store personal data through our open-source practice management software (hereinafter referred to as “PMS” or “the Software”). Our Software is available as a web application and as a mobile application. Unless stated otherwise, the information provided applies equally to both versions. This policy helps you to understand what information we collect, why we collect it, how we use it, and how long we store it.</p>
                </div>







            </div>
        </Container>
    </section>
      
    </>
  )
}

export default PrivacyPolicy
