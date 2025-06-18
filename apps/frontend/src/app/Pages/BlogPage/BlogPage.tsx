import React from "react";
import "./BlogPage.css";
import Image from "next/image";
import { ExploreType } from "../ArticlePage/ArticlePage";
import { GoCheckCircleFill } from "react-icons/go";
import { Button } from "react-bootstrap";
import { FiSearch } from "react-icons/fi";

function BlogPage() {
  return (
    <>
      <section className="BlogPageSec">
        <div className="container">
          <div className="TopBlogDetail">
            <div className="PawnDiv">
              <h2>Paws & Insights</h2>
              <MBTN BICON={<GoCheckCircleFill />} BNAME="Add Blog" />
            </div>
            <div className="BlogPicData">
              <div className="blogPicLeft">
                <div className="Blogpic">
                  <Image
                    aria-hidden
                    src={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/Puppy1.jpg`}
                    alt="puppy"
                    width={847}
                    height={680}
                  />
                  <div className="bloginner">
                    <h3>
                      New Puppy Checklist: Everything You Need to Get
                      Started{" "}
                    </h3>
                    <p>
                      You want to give your puppy a warm welcome to their new
                      home. However, buying for your puppy can be overwhelming
                      when you don’t know where to begin. There are many things
                      to know about caring for your new fur baby...
                    </p>
                  </div>
                </div>
              </div>
              <div className="blogPicRyt">
                <div className="Blogpic">
                  <Image
                    aria-hidden
                    src={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/Puppy2.jpg`}
                    alt="dd"
                    width={413}
                    height={325}
                  />
                  <div className="bloginner">
                    <h3>Care For Your Teething Puppy With These 4 Tips</h3>
                  </div>
                </div>

                <div className="Blogpic">
                  <Image
                    aria-hidden
                    src={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/Puppy3.jpg`}
                    alt="dd"
                    width={413}
                    height={325}
                  />
                  <div className="bloginner">
                    <h3>Does My Cat Love Me? Here&apos;s How To Tell</h3>
                  </div>
                </div>
              </div>
            </div>
            <div className="BlogExploreDiv">
              <div className="topExplore">
                <h4>Explore Topics</h4>
                <div className="Searchbar">
                  <input
                    type="text"
                    id="searchQueryInput"
                    name="searchQueryInput"
                    className="form-control"
                    placeholder="Search by Topic"
                    aria-label="Username"
                    aria-describedby="basic-addon1"
                  />
                  <Button
                    id="searchQuerySubmit"
                    type="submit"
                    name="searchQuerySubmit"
                  >
                    <FiSearch />
                  </Button>
                </div>
              </div>
              <div className="ExploreData">
                <ExploreType />
                <div className="ExploreCardData">
                  <ExplrCard
                    expimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy1.png`}
                    stnme="Skin Care"
                    stmint="5 mins read"
                    Extext="5 Home Remedies for Your Dog’s Itchy Skin"
                    drimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                    drname="Dr. Jamie Sailor"
                    drdays="2 days ago"
                  />
                  <ExplrCard
                    expimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy2.png`}
                    stnme="Senior Cats"
                    stmint="8 mins read"
                    Extext="When Is a Cat Considered a Senior? What To Expect When Your Cat’s Aging"
                    drimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                    drname="Dr. Ken Morrison"
                    drdays="Sep 25, 2024"
                  />
                  <ExplrCard
                    expimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy3.png`}
                    stnme="Nutrition"
                    stmint="5 mins read"
                    Extext="What Are Cat Supplements and How Do They Work?"
                    drimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                    drname="Dr. John David"
                    drdays="Sep 18, 2024"
                  />
                  <ExplrCard
                    expimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy4.png`}
                    stnme="Healthy Living"
                    stmint="5 mins read"
                    Extext="Winter Care for Horses"
                    drimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                    drname="Dr. Lisa Maiden"
                    drdays="2 days ago"
                  />
                  <ExplrCard
                    expimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy5.png`}
                    stnme="Skin Care"
                    stmint="5 mins read"
                    Extext="Dog Not Drinking Water? Possible Causes and When To Call Your Vet"
                    drimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                    drname="Dr. Benny David"
                    drdays="Aug 30, 2024"
                  />
                  <ExplrCard
                    expimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy6.png`}
                    stnme="Wellness"
                    stmint="5 mins read"
                    Extext="Why Horse Rearing Happens and How To Stop It"
                    drimg={`${process.env.VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                    drname="Dr. Susan Martin"
                    drdays="Aug 18, 2024"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default BlogPage;

type ExplrCardProps = {
  expimg: string;
  stnme: string;
  stmint: string;
  Extext: string;
  drimg: string;
  drname: string;
  drdays: string;
};

export const ExplrCard: React.FC<ExplrCardProps> = ({
  expimg,
  stnme,
  stmint,
  Extext,
  drimg,
  drname,
  drdays,
}) => {
  return (
    <div className="explCard">
      <div className="ReltartPic1">
        <Image
          aria-hidden
          src={expimg}
          alt="exploration"
          width={100}
          height={100}
        />
      </div>

      <div className="RelateInner1">
        <div className="Reltdate1">
          <h6>{stnme}</h6>
          <span></span>
          <p>{stmint}</p>
        </div>
        <h5>{Extext}</h5>
      </div>

      <div className="expelp">
        <div className="elpexlor">
          <Image aria-hidden src={drimg} alt="doctor" width={40} height={40} />
          <h6>{drname}</h6>
        </div>
        <p>{drdays}</p>
      </div>
    </div>
  );
};

type MBTNProps = {
  BICON: React.ReactNode; // for JSX icon components like <FaIcon />
  BNAME: string;
};

export function MBTN({ BICON, BNAME }: MBTNProps) {
  return (
    <div className="Mbtn">
      <Button>
        {BICON} {BNAME}
      </Button>
    </div>
  );
}
