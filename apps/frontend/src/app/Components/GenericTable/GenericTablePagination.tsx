import React from "react";
import { Button } from "react-bootstrap";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

import "./Generictable.css";

interface GenericTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const GenericTablePagination: React.FC<GenericTablePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = "custom-pagination",
}) => {
  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Don't render pagination if there's only one page or no items
  if (totalPages <= 1 || totalItems === 0) {
    return null;
  }

  return (
    <div className={className}>
      <Button
        onClick={handlePrev}
        disabled={currentPage === 1}
        style={{ cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
      >
        <FiArrowLeft size={20} />
      </Button>
      <p>
        Showing{" "}
        <span>
          {startItem} of {totalItems}
        </span>
      </p>
      <Button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        style={{
          cursor: currentPage === totalPages ? "not-allowed" : "pointer",
        }}
      >
        <FiArrowRight size={20} />
      </Button>
    </div>
  );
};

export default GenericTablePagination;
