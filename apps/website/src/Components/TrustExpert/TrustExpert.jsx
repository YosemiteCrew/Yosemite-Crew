// components/TrustExpert.jsx
import { motion } from "framer-motion";
import { SectionText } from '../../Pages/Pricing/Pricing';
import { useInView } from "react-intersection-observer";

const expertData = [
  {
    para: `Yosemite Crew has transformed the way we manage our clinic. The open-source platform allows us to customize it to our needs, and the automated workflows save us hours every week!`,
    name: "Dr. Sarah Mitchell",
    position: "Senior Veterinarian",
    clinic: "Paws & Claws Animal Hospital",
    image: "/Homepage/exprt1.png",
    colorClass: "",
  },
  {
    para: `Our team is more efficient, and our clients love the mobile app. It’s made communication so much easier, and patient care is more organized than ever.`,
    name: "Dr. Michael Lawson",
    position: "Director",
    clinic: "Healthy Paws Veterinary Center",
    image: "/Homepage/exprt2.png",
    colorClass: "purpleitem",
    bioClass: "purplebio",
  },
  {
    para: `Switching to Yosemite Crew was the best decision for our practice. The integration with third-party tools and real-time analytics have given us incredible insights into how to improve our operations.`,
    name: "Dr. Emily Carter",
    position: "Clinic Manager",
    clinic: "Furry Friends Veterinary Clinic",
    image: "/Homepage/exprt3.png",
    colorClass: "greenitem",
    bioClass: "greenbio",
  },
];

function TrustExpert() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });

  return (
    <section className="TrustExpertSec" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <SectionText secspan1="Trusted" secblk2="by Veterinary Experts" />
        </motion.div>

        <div
          className="TrustExpertData"
          style={{
            "--trust-image": `url(${import.meta.env.VITE_BASE_IMAGE_URL}/heart.png)`,
          }}
        >
          {expertData.map((expert, index) => (
            <motion.div
              key={index}
              className={`Expertitems ${expert.colorClass || ""}`}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 * (index + 1), duration: 0.5 }}
            >
              <div className="expertPara">
                <p>{expert.para}</p>
              </div>
              <div
                className={`expertBio ${expert.bioClass || ""}`}
              >
                <img
                  src={`${import.meta.env.VITE_BASE_IMAGE_URL}${expert.image}`}
                  alt={expert.name}
                />
                <div className="exprtName">
                  <h6>{expert.name}</h6>
                  <p>
                    {expert.position}
                    <br />
                    {expert.clinic}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TrustExpert;
