import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InventoryInfo from "@/app/components/InventoryInfo";
import { InventoryItem } from "@/app/pages/Inventory/types";
import { BusinessType } from "@/app/types/org";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Labels/Labels", () => ({
  __esModule: true,
  default: ({ labels, setActiveLabel }: any) => (
    <div>
      {labels.map((label: any) => (
        <button
          key={label.key}
          type="button"
          onClick={() => setActiveLabel(label.key)}
        >
          {label.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/InventoryInfo/InfoSection", () => ({
  __esModule: true,
  default: ({ sectionTitle }: any) => (
    <div data-testid="info-section">{sectionTitle}</div>
  ),
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

describe("InventoryInfo", () => {
  const baseInventory: InventoryItem = {
    id: "inv-1",
    status: "ACTIVE",
    basicInfo: {
      name: "Paw Shampoo",
      category: "Grooming",
      subCategory: "Soap",
      department: "Grooming",
      description: "Daily care shampoo",
      status: "Active",
    },
    classification: {},
    pricing: {
      purchaseCost: "10",
      selling: "20",
    },
    vendor: {
      supplierName: "Supplier",
      brand: "Brand",
      vendor: "Vendor",
      license: "LIC-1",
      paymentTerms: "Net 30",
    },
    stock: {
      current: "2",
      allocated: "0",
      available: "2",
      reorderLevel: "1",
      reorderQuantity: "1",
      stockLocation: "Grooming room",
    },
    batch: {
      batch: "",
      manufactureDate: "",
      expiryDate: "",
    },
  } as InventoryItem;

  it("renders modal and hides item when primary action clicked", async () => {
    const onHide = jest.fn().mockResolvedValue(undefined);
    const onUnhide = jest.fn();
    const onUpdate = jest.fn();
    const setShowModal = jest.fn();

    render(
      <InventoryInfo
        showModal={true}
        setShowModal={setShowModal}
        activeInventory={baseInventory}
        businessType={"vet" as BusinessType}
        onUpdate={onUpdate}
        onHide={onHide}
        onUnhide={onUnhide}
      />
    );

    expect(screen.getByText("Paw Shampoo")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Hide item"));

    await waitFor(() => {
      expect(onHide).toHaveBeenCalledWith("inv-1");
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it("unhides item when hidden", async () => {
    const onHide = jest.fn();
    const onUnhide = jest.fn().mockResolvedValue(undefined);
    const onUpdate = jest.fn();
    const setShowModal = jest.fn();

    render(
      <InventoryInfo
        showModal={true}
        setShowModal={setShowModal}
        activeInventory={{ ...baseInventory, status: "HIDDEN" }}
        businessType={"vet" as BusinessType}
        onUpdate={onUpdate}
        onHide={onHide}
        onUnhide={onUnhide}
      />
    );

    fireEvent.click(screen.getByText("Unhide item"));

    await waitFor(() => {
      expect(onUnhide).toHaveBeenCalledWith("inv-1");
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
