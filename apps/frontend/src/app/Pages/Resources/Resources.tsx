import React from 'react'
import "./Resources.css"
import { Container, Form } from 'react-bootstrap'
import { Icon } from '@iconify/react/dist/iconify.js'
import ExploringCard from "@/app/Components/ExploringCard/ExploringCard";

function Resources() {
  return (
    <>
        <section className='ResourcesSec'>
            <Container>
                <div className="ResourcesData">

                    <div className="ResourcesHead">
                        <div className="ResourceTexed">
                            <span>Welcome</span>
                            <h2>Resources</h2>
                            <p>Explore our resources to learn more and get the most out of our platform.</p>
                        </div>
                        <div className="ResourSearch">
                            <Form.Control type="search" placeholder="Search Video"  />
                            <Icon icon="carbon:search" width="24" height="24" />
                        </div>
                    </div>

                    <ExploringCard
                        Headtitle="New Here?"
                        Headtitlespan="Let’s show you around..."
                        Headpara="Here’s everything you can explore and prepare."
                    />

                    <ExploringCard
                        Headtitle="Make the Most of Your Wait"
                        Headtitlespan="— Start Exploring Instead."
                        Headpara="Here’s everything you can explore and prepare."
                    />

                    <ExploringCard
                        Headtitle="New Here?"
                        Headtitlespan="Let’s show you around..."
                        Headpara="Here’s everything you can explore and prepare."
                    />

                </div>
            </Container>
        </section>
    </>
  )
}

export default Resources