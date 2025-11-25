import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/pages/Companions/Companions", () => ({
  __esModule: true,
  default: () => <div data-testid="route-companions">Companions page</div>,
}));

jest.mock("@/app/pages/Inventory", () => ({
  __esModule: true,
  default: () => <div data-testid="route-inventory">Inventory page</div>,
}));

jest.mock("@/app/components/chat/ChatContainer", () => ({
  __esModule: true,
  ChatContainer: () => <div data-testid="route-chat">Chat container</div>,
  default: () => <div data-testid="route-chat">Chat container</div>,
}));

jest.mock("@/app/pages/SignIn/SignIn", () => ({
  __esModule: true,
  default: () => <div data-testid="route-signin">Sign In</div>,
}));

import CompanionsRoute, * as CompanionsModule from "@/app/(routes)/companions/page";
import InventoryRoute from "@/app/(routes)/inventory/page";
import ChatRoute, * as ChatModule from "@/app/(routes)/chat/page";
import SignInRoute, * as SignInModule from "@/app/(routes)/signin/page";

describe("protected route wrappers", () => {
  test("companions route renders ProtectedCompanions", () => {
    render(<CompanionsRoute />);
    expect(screen.getByTestId("route-companions")).toBeInTheDocument();
    expect(typeof CompanionsRoute).toBe("function");
    expect(typeof CompanionsModule.default).toBe("function");
  });

  test("inventory route renders ProtectedInventory", () => {
    render(<InventoryRoute />);
    expect(screen.getByTestId("route-inventory")).toBeInTheDocument();
    expect(typeof InventoryRoute).toBe("function");
  });

  test("chat route renders ChatContainer", () => {
    render(<ChatRoute />);
    expect(screen.getByTestId("route-chat")).toBeInTheDocument();
    expect(typeof ChatModule.default).toBe("function");
  });

  test("signin route renders SignIn within Suspense", () => {
    render(<SignInRoute />);
    expect(screen.getByTestId("route-signin")).toBeInTheDocument();
    expect(typeof SignInModule.default).toBe("function");
  });
});
