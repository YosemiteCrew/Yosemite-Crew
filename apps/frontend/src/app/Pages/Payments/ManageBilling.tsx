'use client';
import React from 'react'
import "./Payments.css";
import { Container } from 'react-bootstrap';
import ManageBillingTable from '@/app/Components/DataTable/ManageBillingTable';
import { HeadText } from '../CompleteProfile/CompleteProfile';

function ManageBilling() {
  return (
    <>
    <section className='ManageBillingSec'>
        <Container>

            <div className="aa">
                <HeadText blktext="Manage Billing" Spntext="" />
                <ManageBillingTable/>
            </div>
            











        </Container>
    </section>
    </>
  )
}

export default ManageBilling