'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import HeadLine from '../HeadLine/HeadLine';
import BoxPract from '../BoxPract/BoxPract';

const headlineVariant = {
  hidden: { opacity: 0, x: -50 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, delay: i * 0.3 },
  }),
};

const boxVariant = {
  hidden: { opacity: 0, y: 50 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.3 + 0.6 },
  }),
};

const PracticeSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const items = [
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Pr1.png`,
      txt1: 'Appointment',
      txt2: 'Scheduling',
      para: 'Easily manage bookings, cancellations, and reminders to minimize no-shows.',
    },
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Pr2.png`,
      txt1: 'Medical Records',
      txt2: 'Management',
      para: 'Organize patient data, treatment history, and prescriptions in one secure platform.',
    },
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Pr3.png`,
      txt1: 'Client',
      txt2: 'Communication',
      para: 'Send automated reminders, updates, and follow-up messages via email or text.',
    },
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Pr4.png`,
      txt1: 'Billing &',
      txt2: 'Payments',
      para: 'Generate invoices, process payments, and track financials with ease.',
    },
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Pr5.png`,
      txt1: 'Invoicing',
      txt2: 'Management',
      para: 'Automate check-out with invoicing, quick payments, downpayments, split payments, and refunds.',
    },
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Pr6.png`,
      txt1: 'Pet Parent',
      txt2: 'App',
      para: 'Give clients a vet-in-your-pocket with a dedicated app for reminders, medical records, and invoices—all in one.',
    },
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Pr7.png`,
      txt1: 'Report &',
      txt2: 'Analytics',
      para: 'Monitor practice performance with detailed insights into appointments, revenue, and client retention.',
    },
    {
      img: `${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/Pr8.png`,
      txt1: 'Inventory',
      txt2: 'Management',
      para: 'Keep track of stock levels, place orders, and receive notifications when supplies are low.',
    },
  ];

  return (
    <section className="PracticeSection" ref={ref}>
      <div className="container">
        <motion.div
          variants={headlineVariant}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          custom={0}
        >
          <HeadLine spnhead="Everything You Need" blkhead="to Run Your Practice" />
        </motion.div>

        <div className="Practice_Box_Data">
          {items.map((item, index) => (
            <motion.div
              key={index}
              variants={boxVariant}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              custom={index}
            >
              <BoxPract
                item={item}
                custom={index}
                variants={boxVariant}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PracticeSection;


