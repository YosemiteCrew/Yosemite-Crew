import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import HeadLine from "../HeadLine/HeadLine";

const WhoCareSection = () => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });

  const imageVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.3 + i * 0.2,
        duration: 0.6,
        ease: "easeOut",
      },
    }),
  };

  return (
    <section className="WhoCareSec" ref={ref}>
      <div className="container">
        <div className="whocareData">
          <div className="lftcare">
            <motion.div
              initial={{ x: -40, opacity: 0 }}
              animate={inView ? { x: 0, opacity: 1 } : {}}
              transition={{ duration: 0.6 }}
            >
              <HeadLine
                spnhead="Caring for the Vets"
                blkhead="Who Care for Pets"
              />
              <p>
                We prioritize your data security and compliance with
                industry-leading standards. Our platform is fully compliant
                with:
              </p>
            </motion.div>
          </div>

          <div className="rytcare">
            <p>Our platform is fully compliant with:</p>
            <div className="carelog">
              {["cr1.png", "cr2.png", "cr3.png"].map((img, i) => (
                <motion.img
                  key={i}
                  custom={i}
                  src={`${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/${img}`}
                  alt={`compliance-logo-${i + 1}`}
                  width={i === 0 ? 109 : i === 1 ? 261 : 194}
                  height={i === 0 ? 112 : i === 1 ? 196 : 137}
                  variants={imageVariants}
                  initial="hidden"
                  animate={inView ? "visible" : "hidden"}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhoCareSection;