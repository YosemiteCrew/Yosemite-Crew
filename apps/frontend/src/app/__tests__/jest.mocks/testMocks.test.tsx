import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
// Import the file to trigger the mock registrations side-effects
import "../../jest.mocks/testMocks";

// Import the mocked modules to verify they are behaving as defined in testMocks.tsx
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Primary, Secondary } from "@/app/components/Buttons";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import GoogleSearchDropDown from "@/app/components/Inputs/GoogleSearchDropDown/GoogleSearchDropDown";

describe("Global Test Mocks Configuration", () => {
  // --- Section 1: Next.js Mocks ---

  describe("next/link Mock", () => {
    it("renders as an anchor tag", () => {
      render(
        <Link href="/test-url" className="test-link">
          Click Me
        </Link>
      );
      const link = screen.getByText("Click Me");
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "/test-url");
      expect(link).toHaveClass("test-link");
    });
  });

  describe("next/image Mock", () => {
    it("renders as a standard img tag with filtered props", () => {
      render(
        <Image
          src="/img.png"
          alt="Test Image"
          width={100}
          height={100}
          priority={true} // Should be filtered out by the mock
          quality={75} // Should be filtered out by the mock
        />
      );
      const img = screen.getByAltText("Test Image");
      expect(img.tagName).toBe("IMG");
      expect(img).toHaveAttribute("src", "/img.png");
      expect(img).toHaveAttribute("width", "100");
      expect(img).not.toHaveAttribute("priority");
    });

    it("handles non-string src gracefully", () => {
      // The mock implementation sets src="" for objects, which React 19/JSDOM may treat as removing the attribute.
      // We override the global console.error spy to ignore the specific React warning about empty src.
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const complexSrc = { src: "/obj.png", height: 10, width: 10 };

      render(<Image src={complexSrc} alt="Complex" />);

      const img = screen.getByAltText("Complex");

      // We check that the src attribute is either empty string or null (missing),
      // verifying that the object was not passed through to the DOM (which would be "[object Object]").
      const srcAttr = img.getAttribute("src");
      expect(srcAttr === "" || srcAttr === null).toBe(true);

      // Restore console.error to default behavior
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: Framer Motion Mocks ---

  describe("framer-motion Mock", () => {
    it("renders motion components as standard HTML elements", () => {
      render(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="motion-box"
          data-testid="motion-div"
        >
          Content
        </motion.div>
      );
      const div = screen.getByTestId("motion-div");
      expect(div.tagName).toBe("DIV");
      expect(div).toHaveClass("motion-box");
      // Verify motion props are stripped from DOM
      expect(div).not.toHaveAttribute("initial");
      expect(div).not.toHaveAttribute("animate");
    });

    it("renders AnimatePresence as a fragment (children only)", () => {
      render(
        <AnimatePresence>
          <div data-testid="child">Child</div>
        </AnimatePresence>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });

  // --- Section 3: UI Component Mocks ---

  describe("Button Component Mocks", () => {
    it("renders Primary button as an anchor", () => {
      const handleClick = jest.fn();
      render(<Primary text="Go" onClick={handleClick} href="/go" />);

      const btn = screen.getByTestId("primary-btn");
      expect(btn).toHaveTextContent("Go");
      expect(btn).toHaveAttribute("href", "/go");

      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalled();
    });

    it("renders Secondary button as a button", () => {
      const handleClick = jest.fn();
      // Added 'href' to satisfy ButtonProps interface, even though Secondary renders a <button>
      render(<Secondary text="Cancel" onClick={handleClick} href="#" />);

      const btn = screen.getByText("Cancel");
      expect(btn.tagName).toBe("BUTTON");

      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalled();
    });
  });

  // --- Section 4: Input Component Mocks ---

  describe("Input Component Mocks", () => {
    it("renders FormInput mock correctly", () => {
      const handleChange = jest.fn();
      // Added 'intype' to satisfy FormInputProps interface
      render(
        <FormInput
          inlabel="Email"
          intype="text"
          value="test"
          onChange={handleChange}
          error="Invalid"
        />
      );

      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test")).toBeInTheDocument();
      expect(screen.getByText("Invalid")).toBeInTheDocument();
    });

    it("renders Dropdown mock correctly", () => {
      const handleChange = jest.fn();
      render(
        <Dropdown placeholder="Select" value="A" onChange={handleChange} />
      );

      expect(screen.getByText("Select")).toBeInTheDocument();
      const input = screen.getByDisplayValue("A");

      fireEvent.change(input, { target: { value: "B" } });
      expect(handleChange).toHaveBeenCalledWith("B");
    });

    it("renders GoogleSearchDropDown mock correctly", () => {
      const handleChange = jest.fn();
      // Added 'intype' to satisfy GoogleSearchDropDownProps interface
      render(
        <GoogleSearchDropDown
          inlabel="Location"
          intype="text"
          value="NYC"
          onChange={handleChange}
        />
      );

      expect(screen.getByText("Location")).toBeInTheDocument();
      expect(screen.getByDisplayValue("NYC")).toBeInTheDocument();
    });
  });
});
