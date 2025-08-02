'use client';
import { motion } from 'framer-motion';
import FocusCard from './FocusCard';
import { SectionText } from '../../Pages/Pricing/Pricing';


const fadeLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6 },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 50 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.3 },
  }),
};

const FocusSection = () => {
  const focusCards = [
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/focus1.png`,
      name: 'API-Driven',
      para:
        'Seamlessly integrate with external tools and systems, offering flexible data sharing and connectivity.',
    },
    {
      cls: 'purplecard',
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/focus2.png`,
      name: 'Open Source',
      para:
        'With Yosemite Crew’s GPL license, you own the software—SaaS simplicity with Open Source freedom and no vendor lock-in.',
    },
    {
      cls: 'browncard',
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/focus3.png`,
      name: 'Automated Workflows',
      para:
        'Automate invoicing, appointment scheduling, and reminders, freeing up your team to focus on what matters most.',
    },
    {
      cls: 'greencard',
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/focus4.png`,
      name: 'Secure & Compliant',
      para:
        'Built with GDPR, SOC2, and ISO 27001 compliance, ensuring the highest standards of security and trust.',
    },
    {
      cls: 'blckcard',
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/focus5.png`,
      name: 'Scalable',
      para:
        'Grow with confidence – whether you\'re a small clinic or a multi-location practice, our software evolves with your needs.',
    },
  ];

  return (
    <section className="FocusSection">
      <div className="container">
        <div className="foctext">
          <SectionText secspan1="Focus on Care," secblk2="Not Admin" />
          <motion.p
            variants={fadeLeft}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            The easy-to-use, cloud-based software that simplifies practice
            management and elevates patient care.
          </motion.p>
        </div>

        <div className="Focus_data">
          {focusCards.map((card, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              <FocusCard
                focadcls={card.cls}
                Focimg={card.img}
                focname={card.name}
                focpara={card.para}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FocusSection;