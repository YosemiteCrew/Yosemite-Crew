import React from 'react'
import "./EmergencyAppointment.css"
import { Col, Container, Row } from 'react-bootstrap'
import StatCard from '@/app/Components/StatCard/StatCard'

function EmergencyAppointment() {
  return (
    <>
    <section>
        <Container>

            <Row>
                <Col md={3}><StatCard icon="/Images/stact1.png" title="Appointments (Today)" value={158} /></Col>
                <Col md={3}><StatCard icon="/Images/stact2.png" title="Staff on-duty" value={122} /></Col>
            </Row>

        </Container>
    </section>



    </>
  )
}

export default EmergencyAppointment