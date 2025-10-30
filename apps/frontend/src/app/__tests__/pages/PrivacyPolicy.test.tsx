import React from "react";
import { render, screen } from "@testing-library/react";
import PrivacyPolicy from "@/app/pages/PrivacyPolicy/PrivacyPolicy";

jest.mock(
  "@/app/components/Footer/Footer",
  () =>
    function MockFooter() {
      return <footer>Footer Mock</footer>;
    }
);

jest.mock(
  "@/app/components/Faq/Faq",
  () =>
    function MockFaq() {
      return <div>FAQ Mock</div>;
    }
);

jest.mock("@/app/pages/HomePage/HomePage", () => ({
  FillBtn: ({ text, href }: { text: string; href?: string }) => (
    <a href={href || "#"}>{text}</a>
  ),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: (props: any) => <span {...props} />,
}));

describe("<PrivacyPolicy /> – legal content sections", () => {
  beforeEach(() => render(<PrivacyPolicy />));

  it("renders main privacy heading", () => {
    expect(
      screen.getByRole("heading", { name: /Privacy Policy/i, level: 2 })
    ).toBeInTheDocument();
  });

  it("shows controller identity", () => {
    expect(screen.getByText(/DuneXploration UG/i)).toBeInTheDocument();
    expect(screen.getByText(/haftungsbeschränkt/i)).toBeInTheDocument();
  });
});
