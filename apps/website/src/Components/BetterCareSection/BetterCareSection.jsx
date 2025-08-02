import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import { FillBtn } from "../FillBtn/FillBtn";

function BetterCareSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section
      className="BettercareSec"
      ref={ref}
      style={{
        "--better-image": `url(${import.meta.env.VITE_BASE_IMAGE_URL}/Homepage/LINES.png)`,
      }}
    >
      <div className="container">
        <div className="BettercareBox">
          <div className="lftbetter">
            <div className="betInner">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6 }}
              >
                <span>Better Care</span> is just a <br /> click away
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                Join hundreds of veterinary clinics already enhancing patient
                care and streamlining their workflow.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <FillBtn
                  FilName="Book a Demo"
                  FilIcon="ri-flashlight-fill "
                  Filhref="#"
                />
              </motion.div>
            </div>
          </div>

          <div className="lftbetter">
            <img
              src={`${
                import.meta.env.VITE_BASE_IMAGE_URL
              }/Homepage/betterimg.png`}
              alt=""
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default BetterCareSection;
