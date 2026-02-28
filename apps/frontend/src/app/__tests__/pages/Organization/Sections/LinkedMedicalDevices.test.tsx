/* eslint-disable @next/next/no-img-element */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LinkedMedicalDevices from "@/app/features/organization/pages/Organization/Sections/LinkedMedicalDevices";

const useIntegrationByProviderForPrimaryOrgMock = jest.fn();
const listIdexxIvlsDevicesMock = jest.fn();

jest.mock("@/app/ui/primitives/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock("@/app/ui/primitives/Buttons", () => ({
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: (selector: any) => selector({ primaryOrgId: "org-1" }),
}));

jest.mock("@/app/hooks/useIntegrations", () => ({
  loadIntegrationsForPrimaryOrg: jest.fn(),
  useIntegrationByProviderForPrimaryOrg: (...args: any[]) =>
    useIntegrationByProviderForPrimaryOrgMock(...args),
}));

jest.mock("@/app/stores/integrationStore", () => ({
  useIntegrationStore: (selector: any) =>
    selector({
      lastFetchedAt: null,
      getIntegrationByProvider: () => null,
    }),
}));

jest.mock("@/app/features/integrations/services/idexxService", () => ({
  listIdexxIvlsDevices: (...args: any[]) => listIdexxIvlsDevicesMock(...args),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

describe("LinkedMedicalDevices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders disabled status with zero linked devices", async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({
      status: "disabled",
    });

    render(<LinkedMedicalDevices />);

    await waitFor(() => {
      expect(screen.getByText("Disabled")).toBeInTheDocument();
    });

    expect(screen.getByText("0 linked IVLS device(s)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open integrations" })).toBeInTheDocument();
  });

  it("renders enabled status and linked device count", async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({
      status: "enabled",
    });
    listIdexxIvlsDevicesMock.mockResolvedValue({
      ivlsDeviceList: [
        { deviceSerialNumber: "A1", displayName: "IVLS 1", vcpActivatedStatus: "ACTIVE", lastPolledCloudTime: "2026-02-27T09:21:37.000+0000" },
        { deviceSerialNumber: "A2", displayName: "IVLS 2", vcpActivatedStatus: "ACTIVE", lastPolledCloudTime: "2026-02-27T09:21:37.000+0000" },
      ],
    });

    render(<LinkedMedicalDevices />);

    await waitFor(() => {
      expect(screen.getByText("Enabled")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/2 linked IVLS device\(s\)/)).toBeInTheDocument();
    });
    expect(listIdexxIvlsDevicesMock).toHaveBeenCalledWith("org-1");
  });

  it("falls back gracefully on fetch error", async () => {
    useIntegrationByProviderForPrimaryOrgMock.mockReturnValue({
      status: "enabled",
    });
    listIdexxIvlsDevicesMock.mockRejectedValue(new Error("network"));

    render(<LinkedMedicalDevices />);

    await waitFor(() => {
      expect(screen.getByText("Enabled")).toBeInTheDocument();
    });
    expect(screen.getByText("0 linked IVLS device(s)")).toBeInTheDocument();
  });
});
