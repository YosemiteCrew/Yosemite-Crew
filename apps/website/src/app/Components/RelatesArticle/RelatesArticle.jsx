
import React from 'react'
import "./RelatesArticle.css"
import Slider from "react-slick";
// import Rls1 from "../../../../public/Images/ArticlePage/Rls1.png"
// import Rls2 from "../../../../public/Images/ArticlePage/Rls2.png"
// import Rls3 from "../../../../public/Images/ArticlePage/Rls3.png"
// import Rls4 from "../../../../public/Images/ArticlePage/Rls4.png"

const RelatesArticle = () => {

    const settings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 4,
        slidesToScroll: 1,
        autoplay: true, 
        autoplaySpeed: 3000
    };


  return (
   
    <div className='RelatesSliderSec'>

        <Slider {...settings}>

            <div className='RelateSlidecard'>
                <div className="ReltartPic">
                    <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ArticlePage/Rls1.png`} alt="Rls1" />
                </div>
                <div className="RelateInner">
                    <div className="Reltdate">
                        <h6>Training</h6>
                        <p>8 mins read</p>
                    </div>
                    <h5>How To Stop a Puppy From Biting</h5>
                </div>
            </div>

            <div className='RelateSlidecard'>
                <div className="ReltartPic">
                    <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ArticlePage/Rls2.png`} alt="Rls2" />
                </div>
                <div className="RelateInner">
                    <div className="Reltdate">
                        <h6>Training</h6>
                        <p>4 mins read</p>
                    </div>
                    <h5>Should You Get Puppy Insurance? Here&apos;s What To Know</h5>
                </div>
            </div>

            <div className='RelateSlidecard'>
                <div className="ReltartPic">
                    <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ArticlePage/Rls3.png`} alt="Rls3" />
                </div>
                <div className="RelateInner">
                    <div className="Reltdate">
                        <h6>Wellness</h6>
                        <p>5 mins read</p>
                    </div>
                    <h5>6 Dog Sleeping Positions and What They Mean</h5>
                </div>
            </div>

            <div className='RelateSlidecard'>
                <div className="ReltartPic">
                    <img src={`${process.env.NX_PUBLIC_VITE_BASE_IMAGE_URL}/ArticlePage/Rls4.png`} alt="Rls4" />
                </div>
                <div className="RelateInner">
                    <div className="Reltdate">
                        <h6>Nutrition</h6>
                        <p>3 mins read</p>
                    </div>
                    <h5>How Much To Feed a Puppy</h5>
                </div>
            </div>
            
        </Slider>






    </div>



  )
}

export default RelatesArticle