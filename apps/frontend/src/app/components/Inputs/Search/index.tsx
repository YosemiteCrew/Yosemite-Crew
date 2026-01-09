import React from "react";
import { IoIosSearch } from "react-icons/io";

const Search = ({ value, setSearch, className }: any) => {
  return (
    <div
      className={`${className ?? ""} w-[280px] rounded-2xl border! border-card-border! px-6 py-[7px] flex items-center justify-center`}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setSearch(e.target.value)}
        className="outline-none border-0 w-full text-body-4 placeholder:text-text-secondary text-text-primary"
        placeholder="Search"
      />
      <IoIosSearch size={22} color="#302F2E" className="cursor-pointer" />
    </div>
  );
};

export default Search;
