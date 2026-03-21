'use client';
import React from 'react';

const WhyWeDoThis = () => {
  return (
    <section className="WhyWeDoThisSec">
      <div className="WhyWeDoThisGrid">
        <div className="WhyWeDoThisContent">
          <h2 className="WhyWeDoThisTitle">Why we do this</h2>
          <div className="WhyWeDoThisText">
            <p>
              Most companies keep their numbers private. We don’t.
              <br />
              At Yosemite Crew, we share them to stay honest. When numbers are public, there’s
              nowhere to hide. You see what’s working and what isn’t. It pushes better decisions.
            </p>
            <p>
              We learned this from open source. Things improve when they’re visible. The same
              applies to companies. What you measure shows what you actually care about, and it
              attracts people who care about the same things.
            </p>
            <p>
              It’s not always comfortable. Some months are messy. But hiding that only delays fixing
              it. Over time, we’ll share more as we build better ways to collect and publish data
              without compromising user sovereignty.
              <br />
              If you’re building in the open, it shouldn’t stop at code.
            </p>
          </div>
        </div>
        <div className="WhyWeDoThisImageWrapper">
          <img
            src="https://d2il6osz49gpup.cloudfront.net/Images/user-overview-image.jpg"
            alt="Veterinarian with a dog"
            className="WhyWeDoThisImage"
          />
        </div>
      </div>
    </section>
  );
};

export default WhyWeDoThis;
