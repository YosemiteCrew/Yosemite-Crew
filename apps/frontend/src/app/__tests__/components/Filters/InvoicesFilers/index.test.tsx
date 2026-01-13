import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import InvoicesFilters from "@/app/components/Filters/InvoicesFilers";
import { Invoice } from "@yosemite-crew/types";

describe("InvoicesFilters", () => {
  it("filters list based on selected status", () => {
    const list: Invoice[] = [
      {
        id: "1",
        status: "PENDING",
        items: [],
        subtotal: 10,
        totalAmount: 15,
        currency: "AED",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invoice,
      {
        id: "2",
        status: "PAID",
        subtotal: 10,
        totalAmount: 15,
        currency: "AED",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invoice,
    ];
    const setFilteredList = jest.fn();

    render(<InvoicesFilters list={list} setFilteredList={setFilteredList} />);

    fireEvent.click(screen.getByText("Paid"));

    const filtered = setFilteredList.mock.calls.at(-1)?.[0] as Invoice[];
    expect(filtered).toHaveLength(1);
    expect(filtered[0].status).toBe("PAID");
  });
});
