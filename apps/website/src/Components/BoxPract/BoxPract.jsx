'use client';

import React from 'react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import BoxPractComponent from './BoxPractComponent';

const BoxPract = ({ item, custom, variants, initial, animate }) => {
  return (
    <motion.div
      variants={variants}
      initial={initial}
      animate={animate}
      custom={custom}
    >
      <BoxPractComponent
        Bpimg={item.img}
        BpTxt1={item.txt1}
        BpTxt2={item.txt2}
        BpPara={item.para}
      />
    </motion.div>
  );
};

BoxPract.propTypes = {
  item: PropTypes.shape({
    img: PropTypes.string.isRequired,
    txt1: PropTypes.string.isRequired,
    txt2: PropTypes.string.isRequired,
    para: PropTypes.string.isRequired,
  }).isRequired,
  custom: PropTypes.number.isRequired,
  variants: PropTypes.object.isRequired,
  initial: PropTypes.string.isRequired,
  animate: PropTypes.string.isRequired,
};

export default BoxPract;
