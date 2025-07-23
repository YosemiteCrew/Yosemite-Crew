"use client";
import React from 'react'
import "./ClientStatements.css"
import { Container } from 'react-bootstrap'
import { HeadText } from '../CompleteProfile/CompleteProfile'
import ClientStatementsTable from '@/app/Components/DataTable/ClientStatementsTable'


function ClientStatementsDashboard() {
  return (
    <>

    <section className='ClientStatementsDashboardSec'>
        <Container>
            <div className="ClientStatementData">
              <HeadText blktext="Client Statements" Spntext="" />
              <ClientStatementsTable/>
            </div>
        </Container>
    </section>


    </>
  )
}

export default ClientStatementsDashboard