import React from 'react'
import './Task.css'
import { Col, Container, Row } from 'react-bootstrap'
import { OverviewDisp } from '../Departments/DepartmentsDashboard'
import StatCard from '@/app/Components/StatCard/StatCard'
import Link from 'next/link'
import { Icon } from '@iconify/react/dist/iconify.js'
import TaskTable from '@/app/Components/DataTable/TaskTable'

function Task() {
  return (
    <>
    <section className='TaskSection'>
        <Container>
            <div className="TaskData">

                <div className="Tasktitle">
                    <h2>Task List </h2>
                    <p>3 New Task</p>
                </div>

                <div className="taskOverviewDiv">
                    <OverviewDisp hideTitle={false} showDropdown={true} />
                    <Row>
                        <Col md={3}><StatCard icon="solar:star-bold" title="New Task" value={2} /></Col>
                        <Col md={3}><StatCard icon="solar:calendar-add-bold" title="All Task" value="03" /></Col>
                        <Col md={3}><StatCard icon="carbon:checkmark-filled" title="Completed Task" value="03" /></Col>
                    </Row>
                </div>

                <div className="TaskCreateBtn">
                    <Link href="/createtask"><Icon icon="solar:add-circle-bold" width="24" height="24"/> Create Task</Link>
                </div>

                <Row>
                    <TaskTable/>
                </Row>

                <Row>
                    <TaskTable/>
                </Row>

                <Row>
                    <TaskTable/>
                </Row>






            </div>
        </Container>
    </section>
      
    </>
  )
}

export default Task
