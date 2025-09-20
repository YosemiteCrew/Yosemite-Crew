import React, { useState } from "react";
import "./FAQ.css";
import { Container } from "react-bootstrap";

function FAQ() {
  // Define the accordion items
  const items = [
    {
      id: "collapseOne",
      title: "What are the benefits of open-source in animal health?",
      content:
        "Open-source models encourage collaboration among researchers, veterinarians, and public health officials by providing a common platform for sharing data and insights.",
    },
    {
      id: "collapseTwo",
      title: "Is Open source model cost effective?",
      content:
        "Open-source solutions can be more affordable than proprietary software, making advanced tools and data management systems accessible to institutions in lower-income countries and to smaller organisations. ",
    },
    {
      id: "collapseThree",
      title:
        "How does Yosemite Crew ensure high data security and reliability?",
      content:
        "We provide ISO 27001 and SOC 2-compliant cloud hosting, daily automatic backups, unlimited cloud storage, and 24x7 support. Plus, the platform is designed to scale with your clinic while keeping all data encrypted and confidential, which many PMS providers cannot guarantee.",
    },
    {
      id: "collapseFour",
      title: "Is your system integrated with an AI scribe?",
      content:
        "Currently, our system does not include AI scribe integration. However, in our next launch, AI scribe integration will be introduced. Along with this, we’ll also be adding features like prescription alerts and PMS plugins—so stay tuned!",
    },
  ];
  // State to track the open accordion item
  const [openItem, setOpenItem] = useState<string | null>(null);
  // Toggle function
  const toggleAccordion = (id: string) => {
    setOpenItem(openItem === id ? null : id);
  };

  return (
    <section className="FaqSection">
      <Container>
        <div className="FaqData">
          <div className="faqhead">
            <h2>
              Frequently Asked <span>Questions</span>
            </h2>
          </div>

          <div className="accordion FAQ_Accordion" id="accordionExample">
            {items.map((item) => (
              <div className="accordion-item Faq_accordion_item" key={item.id}>
                <h5 className="accordion-header FaQ_Header">
                  <button
                    className={`accordion-button Faq_button ${openItem === item.id ? "" : "collapsed"}`}
                    type="button"
                    onClick={() => toggleAccordion(item.id)}
                    aria-expanded={openItem === item.id}
                    aria-controls={item.id}
                  >
                    {item.title}
                  </button>
                </h5>
                <div
                  id={item.id}
                  className={`accordion-collapse collapse ${openItem === item.id ? "show" : ""}`}
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
  );
}

export default FAQ;
