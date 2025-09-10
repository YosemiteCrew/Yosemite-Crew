'use client';
import React, { useState, useEffect } from 'react'
import "./ArticlePage.css"
import { IoIosLink } from "react-icons/io";
import { FaFacebookF , FaLinkedinIn } from "react-icons/fa";
import { RiTwitterXFill } from "react-icons/ri";
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@iconify/react/dist/iconify.js';


const ArticlePage = () => {

  const [activeSection, setActiveSection] = useState('Information');

  const handleScroll = () => {
    const sections = document.querySelectorAll('.artinfoinner');
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
        setActiveSection(section.id);
      }
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);


  return (

    <section className='ArticleSec'>
      <div className="container">

        <div className="Articles_Data">

          <div className="LeftArticle">

            <div className="ArticleBg">
              <Image aria-hidden src={`https://d2il6osz49gpup.cloudfront.net/ArticlePage/puppy.jpg`} alt="puppy" />
              <div className="artinner">
                <div className="tp">
                  <h6>Puppies</h6>
                  <span></span>
                  <h6>How to</h6>
                  <span></span>
                  <h6>Joint Health</h6>
                </div>
                <h3>New Puppy Checklist: Everything You Need to Get Started </h3>
                <div className="bp">
                  <p>Oct 4</p>
                  <span>.</span>
                  <p>10 min read</p>
                </div>
              </div>
            </div>

            <div className="ArticleInfo">

              <div className="artinfoinner" id='Information'>
                <p>You want to give your puppy a warm welcome to their new home.</p>
                <p>However, buying for your puppy can be overwhelming when you don’t know where to begin.</p>
                <p>There are many things to know about caring for your new fur baby.</p>
                <p>So, let’s look at this checklist to help you in your preparations when bringing a new puppy home.</p>
              </div>

              <div className="artinfoinner" id='Veterinarian'>
                <h4>Establish a Relationship With Your Veterinarian</h4>
                <p>Veterinary visits are crucial when it comes to caring for pets. Puppies should visit their veterinarian about every three to four weeks, says Dr. Efrem Hunter, DVM, MBA, a vet and Director of Veterinary and Scientific Affairs at Blue Buffalo.</p>
                <p>Chrissy Joy, a celebrity dog trainer and host of The Dog Moms, has four pups of her own. She says that the first few veterinary visits are critical, even for pups who come from healthy moms.</p>
                <p>“ Meeting with your vet soon after bringing your puppy home is important,” she says. Puppies need essential vaccines that allow them to safely explore the outdoors and socialize with other pups. They’re also prone to parasites, which your vet can check for and quickly treat.
                Setting your puppy up with a qualified vet makes it easy to navigate their primary medical care. Consider these factors when choosing your vet:</p>
                <ul>
                  <li><strong>Distance from home:</strong> You don’t want to drive far for routine visits, and you’ll want to be able to get to the vet quickly in case of an emergency.</li>
                  <li><strong>Services provided:</strong> Make sure the vet offers the services you want, such as dental care, nutrition counselling, and spay and neuter surgeries. Having all services in one office can be a perk, though it’s not mandatory.</li>
                  <li><strong>Experience:</strong> Choose a vet who routinely works with your pet’s breed. Additionally, fear-free certified vets can prevent and reduce fear,anxiety, and stress in pets.</li>
                  <li><strong>The space:</strong> Ask whether you’re able to enter the examination room with your pet and if the office has separate waiting areas and rooms for cats and dogs, as this can help prevent potential conflicts and stress between our different furry friends.</li>
                </ul>
                <p>In talking with your vet, you’ll quickly understand that preventative care is key to your pup’s well-being, including keeping vaccinations up to date and protecting your precious pooch against fleas, ticks, and heartworms.</p>
              </div>

              <div className="artinfoinner" id='PuppyFood'>
                <h4>Puppy Food</h4>
                <p>You’ll need to have plenty of high-quality puppy food on hand for your newly adopted pup.</p>
                <p>To help them power through their days, select a puppy food with a nutritional adequacy statement for growth or all life stages from the Association of American Feed Control Officials (AAFCO). You’ll find this info on the pet food label.</p>
                <Image aria-hidden src={`https://d2il6osz49gpup.cloudfront.net/ArticlePage/fedding.png`} alt="fedding" />
                <p>“It’s always a good idea to ask your vet for nutritional counseling, to make sure your dog’s specific calorie requirements and other nutritional needs are being met,” Dr. Hunter says.</p>
                <p>If your puppy will be 50 pounds or more by adulthood, they may require large breed puppy food.</p>
                
              </div>
              
              <div className="artinfoinner">
                <h4>Here are a few recommended large breed puppy food brand:</h4>
                <Image aria-hidden src={`https://d2il6osz49gpup.cloudfront.net/ArticlePage/artcart.png`} alt="artcart" id='Bedding' />
              </div>
              
              <div className="artinfoinner" id='Conclusion'>
                <h4>Conclusion</h4>
                <p>Congratulations on your new puppy!</p>
                <p>This checklist will help you set the stage for a lifetime of love, joy, and cherished memories with your new best friend.</p>
                <p>While puppies are a lot of work, the time, energy, and budget you invest in your new furry family member using this checklist will give you all the tools you need to start your journey together.</p>
              </div>

              <div className="ArticleShare">
                <h6>Like what you see? Share with a friend.</h6>
                <div className="blLinkgrn">
                  <Link href="#"><IoIosLink /></Link>
                  <Link href="#"><FaFacebookF /></Link>
                  <Link href="#"><RiTwitterXFill /></Link>
                  <Link href="#"><FaLinkedinIn /></Link>
                </div>

              </div>

            </div>

          </div>

          <div className="RytArticle">

            <div className="blgdr">
              <div className="bldrinfo">
                <Image aria-hidden  src={`https://d2il6osz49gpup.cloudfront.net/ArticlePage/drpic.png`} alt="drpic" width={100} height={100} />
                <div className="bldrtext">
                  <h6>Dr. Amanda Lee</h6>
                  <p>Cardiology</p>
                  <p>DVM - Cornell University</p>
                </div>
              </div>
              <p>With over 10 years of veterinary experience, Dr Amanda has a deep passion for advancing pet heart health. Dr. Lee has worked with numerous pets, ensuring high-quality care and treatment plans that keep them thriving.</p>
            </div>
            <div className="ShareCommunity">
              <h6>Share with your community!</h6>
              <div className="blLink">
                <Link href="#"><IoIosLink /></Link>
                <Link href="#"><FaFacebookF /></Link>
                <Link href="#"><RiTwitterXFill /></Link>
                <Link href="#"><FaLinkedinIn /></Link>
              </div>
            </div>

            <div className="InArticle">
              <h4>In this article</h4>
              <div className="inarticleInner">
                <a href="#Information" className={activeSection === 'Information' ? 'active' : ''}>Introduction</a>
                <a href="#Veterinarian" className={activeSection === 'Veterinarian' ? 'active' : ''}>Establish a Relationship With Your Veterinarian</a>
                <a href="#PuppyFood" className={activeSection === 'PuppyFood' ? 'active' : ''}>Puppy Food</a>
                <a href="#TrainingTreats" className={activeSection === 'TrainingTreats' ? 'active' : ''}>Puppy Training Treats</a>
                <a href="#Essentials" className={activeSection === 'Essentials' ? 'active' : ''}>Water Bowls and Other Puppy Essentials for Home and Traveling</a>
                <a href="#Toys" className={activeSection === 'Toys' ? 'active' : ''}>Toys for Your New Puppy</a>
                <a href="#Gates" className={activeSection === 'Gates' ? 'active' : ''}>Puppy Gates, Playpens, and Crates</a>
                <a href="#Bedding" className={activeSection === 'Bedding' ? 'active' : ''}>Bedding for Your Puppy</a>
                <a href="#Socialization" className={activeSection === 'Socialization' ? 'active' : ''}>Socialization for Your Puppy</a>
                <a href="#IDTags" className={activeSection === 'IDTags' ? 'active' : ''}>ID Tags and Microchipping</a>
                <a href="#Conclusion" className={activeSection === 'Conclusion' ? 'active' : ''}>Conclusion</a>
              </div>

            </div>

            <div className="explorTopic">
              <h4>Explore Topics</h4>

              {/* <ExploreType /> */}

            </div>




          </div>


        </div>

        <div className="RelatesArticle">
          <h4>Related Articles</h4>
          {/* <RelatesArticle/> */}
        </div>

      </div>
    </section>




  )
}

export default ArticlePage


interface ExploreTypeProps {
  onFilterChange: (filters: { animalType?: string; topic?: string }) => void;
}

export function ExploreType({ onFilterChange,clearFilter}: {onFilterChange:({ animalType, topic }: { animalType?: string; topic?: string })=>void;clearFilter: () => void}) {
 const [selectedAnimal, setSelectedAnimal] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const handleAnimalClick = (animal: string) => {
    const newAnimal = selectedAnimal === animal ? null : animal;
    setSelectedAnimal(newAnimal);
    onFilterChange({ animalType: newAnimal || undefined, topic: selectedTopic || undefined });
  };

  const handleTopicClick = (topic: string) => {
    const newTopic = selectedTopic === topic ? null : topic;
    setSelectedTopic(newTopic);
    onFilterChange({ animalType: selectedAnimal || undefined, topic: newTopic || undefined });
  };
  return (
    <div className="explorDiv">
      <div className="bltype">
        <div className="typtext">
          <Image aria-hidden src="https://d2il6osz49gpup.cloudfront.net/Images/petfoot.png" alt="petfoot" width={24} height={24} />
          <h6>Animal Type</h6>
           {/* <div style={{color:"blue",cursor:"pointer"}} onClick={clearFilter}>Clear Filter</div> */}
        </div>
        <div className="typeinfo">
          {["Cats", "Dogs", "Horses"].map((animal) => (
            <Link
              href="#"
              key={animal}
              onClick={(e) => {
                e.preventDefault();
                handleAnimalClick(animal);
              }}
              className={selectedAnimal === animal ? "active" : ""}
            >
              {animal}
            </Link>
          ))}
        </div>
      </div>
      <div className="bltype">
        <div className="typtext">
          {/* <Image aria-hidden src="https://d2il6osz49gpup.cloudfront.net/Images/blueLiabry.png" alt="blueLiabry" width={24} height={24} /> */}
          <Icon icon="solar:library-bold" width="24" height="24" />
          <h6>Topics</h6>
        </div>
        <div className="typeinfo">
          {[
            "Nutrition",
            "Medication",
            "Fleas and Ticks",
            "Pet Anxiety",
            "Mental Health",
            "Allergies",
            "Socialization",
            "Skin Care",
            "Limping",
            "Wellness",
            "Insurance",
          ].map((topic) => (
            <Link
              href="#"
              key={topic}
              onClick={(e) => {
                e.preventDefault();
                handleTopicClick(topic);
              }}
              className={selectedTopic === topic ? "active" : ""}
            >
              {topic}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

