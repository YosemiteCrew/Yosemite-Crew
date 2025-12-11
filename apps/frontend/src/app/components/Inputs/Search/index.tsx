import React from "react";
import { IoSearch } from "react-icons/io5";

const Search = ({ value, setSearch, className }: any) => {
  return (
    <div
      className={`${className ?? ""} h-10! min-h-10! rounded-2xl border! border-[#BFBFBE]! px-3 py-2.5 flex items-center justify-center`}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setSearch(e.target.value)}
        className="outline-none border-0 text-[15px]!"
        placeholder="Search"
      />
      <IoSearch size={22} color="#302F2E" className="cursor-pointer" />
    </div>
  );
};

export default Search;
