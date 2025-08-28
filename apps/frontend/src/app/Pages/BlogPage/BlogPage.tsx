"use client";
import "./BlogPage.css";
import Image from "next/image";
import { ExploreType } from "../ArticlePage/ArticlePage";
import { GoCheckCircleFill } from "react-icons/go";
import { Button } from "react-bootstrap";
import { FiSearch } from "react-icons/fi";
import Link from "next/link";
import { getData } from "@/app/axios-services/services";
import { useEffect, useState } from "react";
import { convertFHIRBlogsToNormal } from "@yosemite-crew/fhir";

function BlogPage() {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
const [filters, setFilters] = useState<{ animalType?: string; topic?: string }>({});
  useEffect(() => {
    fetchBlogs();
  }, [filters]);

  const fetchBlogs = async () => {
    try {
      const query = new URLSearchParams(filters as any).toString();
      const response: any = await getData(`/fhir/v1/get-blogs?${query}`);
      if (!response) throw new Error("Failed to fetch blogs");
console.log(response.data);
      const blogs = convertFHIRBlogsToNormal(response.data);
      setBlogs(blogs);
      console.log("Blogs fetched successfully:", blogs);
    } catch (error) {
      console.error("Error fetching blogs:", error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search) return fetchBlogs();
    const filtered = blogs.filter((b) =>
      b.topic?.toLowerCase().includes(search.toLowerCase())
    );
    setBlogs(filtered);
  };
  const clearFilter = () => { 
    setFilters({});
   }
console.log(blogs,"Filters")
  return (
    <>
      <section className="BlogPageSec">
        <div className="container">
          <div className="TopBlogDetail">
            <div className="PawnDiv">
              <h2>Paws & Insights</h2>
              <MBTN
                BICON={<GoCheckCircleFill />}
                BNAME="Add Blog"
                BtHerf="CreateBlog"
              />
            </div>

            {/* ---- Featured Blogs ---- */}
            <div className="BlogPicData">
              {blogs.length > 0 ? (
                <>
                  <div className="blogPicLeft">
                    <div className="Blogpic">
                      <img
                        aria-hidden
                        src={`${process.env.NEXT_PUBLIC_CLOUD_FRONT}`+ blogs[0]?.image || "/default-blog.jpg"}
                        alt="featured"
                        width={847}
                        height={680}
                      />
                      <div className="bloginner">
                        <h3>{blogs[0]?.blogTitle}</h3>
                        <p>{blogs[0]?.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="blogPicRyt">
                    {blogs.slice(1, 3).map((b, i) => (
                      <div className="Blogpic" key={i}>
                        <img
                          aria-hidden
                          src={process.env.NEXT_PUBLIC_CLOUD_FRONT + b.image || "/default-blog.jpg"}
                          alt="featured-small"
                          width={413}
                          height={325}
                        />
                        <div className="bloginner">
                          <h3>{b.blogTitle}</h3>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p>Loading blogs...</p>
              )}
            </div>

            {/* ---- Explore Blogs ---- */}
            <div className="BlogExploreDiv">
              <div className="topExplore">
                <h4>Explore Topics</h4>
                <form className="Searchbar" onSubmit={handleSearch}>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by Topic"
                    className="form-control"
                  />
                  <Button type="submit">
                    <FiSearch />
                  </Button>
                </form>
              </div>

              <div className="ExploreData">
               
                <ExploreType onFilterChange={setFilters} clearFilter={clearFilter} />

                <div className="ExploreCardData">
                  {blogs.length > 0 ? (
                    blogs.map((b, i) => (
                      <ExplrCard
                        key={i}
                        expimg={process.env.NEXT_PUBLIC_CLOUD_FRONT + b.image || "/default-blog.jpg"}
                        stnme={b.topic}
                        stmint="5 mins read"
                        Extext={b.blogTitle}
                        drimg={b.authorImage || "/default-doctor.jpg"}
                        drname={b.author || "Dr. Unknown"}
                        drdays={new Date(b.createdAt).toDateString()}
                      />
                    ))
                  ) : (
                    <p>No blogs found</p>
                  )}
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
        <img
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
          <img aria-hidden src={drimg} alt="doctor" width={40} height={40} />
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
  BtHerf: string;
};

export function MBTN({ BICON, BNAME, BtHerf }: MBTNProps) {
  return (
    <div className="Mbtn">
      <Link href={BtHerf}>
        {BICON} {BNAME}
      </Link>
    </div>
  );
}
