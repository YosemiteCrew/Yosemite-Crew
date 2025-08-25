import React , {useState} from 'react'
import "./FAQ.css"
import { Container } from 'react-bootstrap'

function FAQ() {

    
    // Define the accordion items
    const items = [
        {
            id: 'collapseOne',
            title: 'What is the difference between the managed service and self hosting?',
            content: 'The same features are available in both options. In self hosted, you can use the open source features of SuperTokens for free at any scale and pay only for the paid features mentioned in “Scale”. With the managed service, SuperTokens handles on demand scalability, reliability and updates - essentially reducing your devops workload. With the self hosted version, everything is managed within your infrastructure.',
        },
        {
            id: 'collapseTwo',
            title: 'Do you provide discounts for large volumes?',
            content: 'This is the second item\'s accordion body.',
        },
        {
            id: 'collapseThree',
            title: 'Can I get help in evaluating Yosemite Crew?',
            content: 'This is the third item\'s accordion body.',
        },
        {
            id: 'collapseFour',
            title: 'How scalable is Yosemite Crew?',
            content: 'This is the third item\'s accordion body.',
        },
    ];
    // State to track the open accordion item
    const [openItem, setOpenItem] = useState<string | null>(null);
    // Toggle function
    const toggleAccordion = (id: string) => {
    setOpenItem(openItem === id ? null : id);
    };
    
    



  return (
    <>

        <section className='FaqSection'>
            <Container>
                <div className="FaqData">

                    <div className="faqhead">
                        <h2>Frequently Asked <span>Questions</span></h2>
                    </div>

                    <div className="accordion FAQ_Accordion" id="accordionExample">
                        {items.map(item => (
                            <div className="accordion-item Faq_accordion_item" key={item.id}>
                            <h5 className="accordion-header FaQ_Header">
                                <button
                                className={`accordion-button Faq_button ${openItem === item.id ? '' : 'collapsed'}`}
                                type="button"
                                onClick={() => toggleAccordion(item.id)}
                                aria-expanded={openItem === item.id}
                                aria-controls={item.id}>
                                {item.title}
                                </button>
                            </h5>
                            <div
                                id={item.id}
                                className={`accordion-collapse collapse ${openItem === item.id ? 'show' : ''}`}
                                data-bs-parent="#accordionExample"
                            >
                                <div className="accordion-body">
                                <p>{item.content}</p> 
                                </div>
                            </div>
                            </div>
                        ))}
                    </div>



                </div>

            </Container>


        </section>
      
    </>
  )
}

export default FAQ
