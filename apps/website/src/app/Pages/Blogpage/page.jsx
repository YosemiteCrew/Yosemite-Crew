import React from 'react';
import './Blogpage.css';
import { AiFillPlusCircle } from 'react-icons/ai';
import PropTypes from 'prop-types';
// import Puppy1 from '../../../../public/Images/Blogpage/Puppy1.jpg';
// import Puppy2 from '../../../../public/Images/Blogpage/Puppy2.jpg';
// import Puppy3 from '../../../../public/Images/Blogpage/Puppy3.jpg';
import { ExploreType } from '../ArticlePage/page';
// import cardpuppy1 from '../../../../public/Images/Blogpage/cardpuppy1.png';
// import cardpuppy2 from '../../../../public/Images/Blogpage/cardpuppy2.png';
// import cardpuppy3 from '../../../../public/Images/Blogpage/cardpuppy3.png';
// import cardpuppy4 from '../../../../public/Images/Blogpage/cardpuppy4.png';
// import cardpuppy5 from '../../../../public/Images/Blogpage/cardpuppy5.png';
// import cardpuppy6 from '../../../../public/Images/Blogpage/cardpuppy6.png';
// import drf from '../../../../public/Images/Blogpage/drf.jpg';

const Blogpage = () => {
  return (
    <section className="BlogPageSec">
      <div className="container">
        <div className="TopBlogDetail">
          <div className="PawnDiv">
            <h2>Paws & Insights</h2>
            <MBTN BICON={<AiFillPlusCircle />} BNAME="Add Blog" />
          </div>
          <div className="BlogPicData">
            <div className="blogPicLeft">
              <div className="Blogpic">
                <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/Puppy1.jpg`} alt="puppy" width={847} height={680} />
                <div className="bloginner">
                  <h3>
                    New Puppy Checklist: Everything You Need to Get Started{' '}
                  </h3>
                  <p>
                    You want to give your puppy a warm welcome to their new
                    home. However, buying for your puppy can be overwhelming
                    when you don’t know where to begin. There are many things to
                    know about caring for your new fur baby...
                  </p>
                </div>
              </div>
            </div>
            <div className="blogPicRyt">
              <div className="Blogpic">
                <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/Puppy2.jpg`} alt="puppy" width={413} height={325} />
                <div className="bloginner">
                  <h3>Care For Your Teething Puppy With These 4 Tips</h3>
                </div>
              </div>

              <div className="Blogpic">
                <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/Puppy3.jpg`} alt="puppy" width={413} height={325} />
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
                <button
                  id="searchQuerySubmit"
                  type="submit"
                  name="searchQuerySubmit"
                >
                  <i className="ri-search-line"></i>
                </button>
              </div>
            </div>
            <div className="ExploreData">
              <ExploreType />
              <div className="ExploreCardData">
                <ExplrCard
                  expimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy1.png`}
                  stnme="Skin Care"
                  stmint="5 mins read"
                  Extext="5 Home Remedies for Your Dog’s Itchy Skin"
                  drimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                  drname="Dr. Jamie Sailor"
                  drdays="2 days ago"
                />
                <ExplrCard
                  expimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy2.png`}
                  stnme="Senior Cats"
                  stmint="8 mins read"
                  Extext="When Is a Cat Considered a Senior? What To Expect When Your Cat’s Aging"
                  drimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                  drname="Dr. Ken Morrison"
                  drdays="Sep 25, 2024"
                />
                <ExplrCard
                  expimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy3.png`}
                  stnme="Nutrition"
                  stmint="5 mins read"
                  Extext="What Are Cat Supplements and How Do They Work?"
                  drimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                  drname="Dr. John David"
                  drdays="Sep 18, 2024"
                />
                <ExplrCard
                  expimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy4.png`}
                  stnme="Healthy Living"
                  stmint="5 mins read"
                  Extext="Winter Care for Horses"
                  drimg={ `${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                  drname="Dr. Lisa Maiden"
                  drdays="2 days ago"
                />
                <ExplrCard
                  expimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy5.png`}
                  stnme="Skin Care"
                  stmint="5 mins read"
                  Extext="Dog Not Drinking Water? Possible Causes and When To Call Your Vet"
                  drimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                  drname="Dr. Benny David"
                  drdays="Aug 30, 2024"
                />
                <ExplrCard
                  expimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/cardpuppy6.png`}
                  stnme="Wellness"
                  stmint="5 mins read"
                  Extext="Why Horse Rearing Happens and How To Stop It"
                  drimg={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/Blogpage/drf.jpg`}
                  drname="Dr. Susan Martin"
                  drdays="Aug 18, 2024"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Blogpage;

ExplrCard.propTypes = {
  expimg: PropTypes.string,
  stnme: PropTypes.string,
  stmint: PropTypes.string,
  Extext: PropTypes.string,
  drimg: PropTypes.string,
  drname: PropTypes.string,
  drdays: PropTypes.string,
};
export function ExplrCard({
  expimg,
  stnme,
  stmint,
  Extext,
  drimg,
  drname,
  drdays,
}) {
  return (
    <div className="explCard">
      <div className="ReltartPic1">
        <img src={expimg} alt="expimg" />
      </div>
      <div className="RelateInner1">
        <div className="Reltdate1">
          <h6>{stnme}</h6>
          <span></span>
          <p>{stmint}</p>
        </div>
        <h5>{Extext} </h5>
      </div>
      <div className="expelp">
        <div className="elpexlor">
          <img src={drimg} alt="cardpuppy1" width={40} height={40} />
          <h6>{drname}</h6>
        </div>
        <p>{drdays}</p>
      </div>
    </div>
  );
}

// MBTN
MBTN.propTypes = {
  BICON: PropTypes.string,
  BNAME: PropTypes.string,
};
export function MBTN({ BICON, BNAME }) {
  return (
    <div className="Mbtn">
      <button>
        {BICON} {BNAME}
      </button>
    </div>
  );
}
