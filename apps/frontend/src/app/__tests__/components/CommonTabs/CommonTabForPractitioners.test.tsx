import React, { ReactElement, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import CommonTabForPractitioners from "../../../components/CommonTabs/CommonTabForPractitioners";

const mockTableProps: any = {};
jest.mock(
  "@/app/components/DataTable/PracticeteamtableForBusinessDashboard",
  () => {
    const MockTable = (props: any) => {
      Object.assign(mockTableProps, props);
      return <div data-testid="mock-table" />;
    };
    MockTable.displayName = "MockPracticeteamtableForBusinessDashboard";
    return MockTable;
  }
);

type MockComponent<P = object> = React.FC<P> & { displayName?: string };

jest.mock("react-bootstrap", () => {
  const OriginalModule = jest.requireActual("react-bootstrap");

  type TabProps = { eventKey: string; title?: ReactNode; children?: ReactNode };
  type TabsProps = {
    children: ReactNode;
    defaultActiveKey: string;
    onSelect?: (key: string | null) => void;
  };

  const Tabs: MockComponent<TabsProps> = ({
    children,
    defaultActiveKey,
    onSelect,
  }) => {
    const [activeKey, setActiveKey] = React.useState<string>(defaultActiveKey);

    const tabs = React.Children.toArray(children).filter(
      (c): c is ReactElement<TabProps> => React.isValidElement(c)
    );

    const activeTab = tabs.find((child) => child.props.eventKey === activeKey);

    return (
      <div>
        <div role="tablist">
          {tabs.map((child) => (
            <button
              key={child.props.eventKey}
              role="tab"
              aria-selected={child.props.eventKey === activeKey}
              onClick={() => {
                const newKey = child.props.eventKey;
                setActiveKey(newKey);
                if (onSelect) onSelect(newKey);
              }}
            >
              {child.props.title}
            </button>
          ))}
        </div>
        <div role="tabpanel">{activeTab}</div>
      </div>
    );
  };
  Tabs.displayName = "Tabs";

  const Tab: MockComponent<TabProps> = ({ children }) => <>{children}</>;
  Tab.displayName = "Tab";

  type DropdownItemProps = {
    children: ReactNode;
    onClick?: () => void;
    eventKey?: string;
  };
  type DropdownProps = {
    children: ReactNode;
    onSelect?: (eventKey: string | null) => void;
  };

  const Dropdown: MockComponent<DropdownProps> & {
    Toggle?: MockComponent<{ children: ReactNode; id?: string }>;
    Menu?: MockComponent<{ children: ReactNode }>;
    Item?: MockComponent<DropdownItemProps>;
  } = ({ children, onSelect }) => {
    const childArray = React.Children.toArray(children).filter(
      (c): c is ReactElement => React.isValidElement(c)
    );

    const Toggle = childArray[0];
    const Menu = childArray[1];

    if (!React.isValidElement<{ children?: ReactNode }>(Menu)) {
      return <div>{Toggle}</div>;
    }

    if (!Menu?.props.children) return <div>{Toggle}</div>;

    const items = React.Children.map(Menu.props.children, (child) => {
      if (React.isValidElement<DropdownItemProps>(child)) {
        return React.cloneElement(child, {
          onClick: () => onSelect?.(child.props.eventKey ?? null),
        });
      }
      return child;
    });

    return (
      <div>
        {Toggle}
        {items}
      </div>
    );
  };
  Dropdown.displayName = "Dropdown";

  const DropdownToggle: MockComponent<{ children: ReactNode; id?: string }> = ({
    children,
    id,
  }) => <button data-testid={id}>{children}</button>;
  Dropdown.Toggle = DropdownToggle;

  const DropdownMenu: MockComponent<{ children: ReactNode }> = ({
    children,
  }) => <div>{children}</div>;
  Dropdown.Menu = DropdownMenu;

  const DropdownItem: MockComponent<DropdownItemProps> = ({
    children,
    onClick,
  }) => <button onClick={onClick}>{children}</button>;
  Dropdown.Item = DropdownItem;

  return { ...OriginalModule, Tabs, Tab, Dropdown };
});

const mockTabs = [
  { eventKey: "dept1", title: "Cardiology" },
  { eventKey: "dept2", title: "Neurology" },
];

describe("CommonTabForPractitioners Component", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    for (const key in mockTableProps) {
      delete mockTableProps[key];
    }
  });

  test("should render tabs and pass default props to the table", () => {
    render(<CommonTabForPractitioners tabs={mockTabs} showStatusSelect />);
    expect(screen.getByRole("tab", { name: "Cardiology" })).toBeInTheDocument();
    expect(screen.getByTestId("mock-table")).toBeInTheDocument();
    expect(mockTableProps.departmentId).toBe("dept1");
    expect(mockTableProps.role).toBe("all");
  });

  test("should not render dropdown if showStatusSelect is false", () => {
    render(
      <CommonTabForPractitioners tabs={mockTabs} showStatusSelect={false} />
    );
    expect(screen.queryByText("Role:")).not.toBeInTheDocument();
  });

  test("should update role and pass it to the table when dropdown selection changes", async () => {
    render(<CommonTabForPractitioners tabs={mockTabs} showStatusSelect />);
    const dropdownToggle = screen.getByTestId("dropdown-status");
    expect(dropdownToggle).toHaveTextContent("All");
    const vetOption = screen.getByRole("button", { name: "Vet" });
    await user.click(vetOption);
    expect(dropdownToggle).toHaveTextContent("Vet");
    expect(mockTableProps.role).toBe("vet");
    expect(mockTableProps.departmentId).toBe("dept1");
  });

  test("should update departmentId when a new tab is selected", async () => {
    render(<CommonTabForPractitioners tabs={mockTabs} showStatusSelect />);
    expect(mockTableProps.departmentId).toBe("dept1");
    const neurologyTab = screen.getByRole("tab", { name: "Neurology" });
    await user.click(neurologyTab);
    expect(mockTableProps.departmentId).toBe("dept2");
    expect(mockTableProps.role).toBe("all");
  });
});
