import React, { useState } from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';

import './Faq.css';

const FAQ_ITEMS = [
  {
    id: 'collapseOne',
    title: 'What are the benefits of open-source in animal health?',
    content:
      'Open-source models encourage collaboration among researchers, veterinarians, and public health officials by providing a common platform for sharing data and insights.',
  },
  {
    id: 'collapseTwo',
    title: 'Is Open source model cost effective?',
    content:
      'Open-source solutions can be more affordable than proprietary software, making advanced tools and data management systems accessible to institutions in lower-income countries and to smaller organisations. ',
  },
  {
    id: 'collapseThree',
    title: 'How does Yosemite Crew ensure high data security and reliability?',
    content:
      'We provide ISO 27001 and SOC 2-compliant cloud hosting, daily automatic backups, unlimited cloud storage, and 24x7 support. Plus, the platform is designed to scale with your clinic while keeping all data encrypted and confidential, which many PMS providers cannot guarantee.',
  },
  {
    id: 'collapseFour',
    title: 'Is your system integrated with an AI scribe?',
    content:
      'Currently, our system does not include AI scribe integration. However, in our next launch, AI scribe integration will be introduced. Along with this, we’ll also be adding features like prescription alerts and PMS plugins.',
  },
  {
    id: 'collapseFive',
    title: 'What are observational tools?',
    content:
      'Observational tools are structured methods for assessing animal welfare, pain, or stress based on observable indicators such as facial expressions, posture, or behavioural changes rather than invasive or physiological measures.',
  },
];

const Faq = () => {
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <section className="FaqSection" aria-labelledby="pricing-faq-heading">
      <div className="FaqData">
        <div className="faqhead">
          <h2 id="pricing-faq-heading">Frequently asked questions</h2>
        </div>

        <div className="FAQ_Accordion">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openItem === item.id;

            return (
              <div className="Faq_accordion_item" key={item.id}>
                <Accordion
                  title={item.title}
                  showEditIcon={false}
                  open={isOpen}
                  onOpenChange={(nextOpen) => setOpenItem(nextOpen ? item.id : null)}
                >
                  <div id={item.id} className="Faq_panel">
                    <p>{item.content}</p>
                  </div>
                </Accordion>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Faq;
