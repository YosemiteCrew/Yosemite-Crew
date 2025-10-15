import React, { ReactElement, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CommonTabs from '../../../components/CommonTabs/CommonTabs';

type MockComponent<P = object> = React.FC<P> & { displayName?: string };

jest.mock('react-bootstrap', () => {
    const OriginalModule = jest.requireActual('react-bootstrap');

    type TabProps = { eventKey: string; title?: ReactNode; children?: ReactNode };
    type TabsProps = { children: ReactNode; defaultActiveKey: string; onSelect?: (key: string | null) => void };

    const Tabs: MockComponent<TabsProps> = ({ children, defaultActiveKey, onSelect }) => {
        const [activeKey, setActiveKey] = React.useState<string>(defaultActiveKey);

        const tabs = React.Children.toArray(children)
            .filter((c): c is ReactElement<TabProps> => React.isValidElement(c));

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
    Tabs.displayName = 'Tabs';

    const Tab: MockComponent<TabProps> = ({ children }) => <>{children}</>;
    Tab.displayName = 'Tab';

    type DropdownItemProps = { children: ReactNode; onClick?: () => void; eventKey?: string };
    type DropdownProps = { children: ReactNode; onSelect: (eventKey: string | null) => void };

    const Dropdown: MockComponent<DropdownProps> & {
        Toggle?: MockComponent<{ children: ReactNode; id?: string }>;
        Menu?: MockComponent<{ children: ReactNode }>;
        Item?: MockComponent<DropdownItemProps>;
    } = ({ children, onSelect }) => {
        const childArray = React.Children.toArray(children).filter(
            (c): c is ReactElement => React.isValidElement(c)
        );

        const Toggle = childArray[0];
        const Menu = childArray[1] as ReactElement<{ children?: ReactNode }> | undefined;

        if (!Menu?.props.children) return <div>{Toggle}</div>;

        const items = React.Children.map(Menu.props.children, (child) => {
            if (React.isValidElement<DropdownItemProps>(child)) {
                return React.cloneElement(child, { onClick: () => onSelect(child.props.eventKey ?? null) });
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
    Dropdown.displayName = 'Dropdown';

    // FIX 1: Defined Dropdown sub-components as named constants before assigning them.
    const DropdownToggle: MockComponent<{ children: ReactNode; id?: string }> = ({ children }) => <button>{children}</button>;
    DropdownToggle.displayName = 'DropdownToggle';
    Dropdown.Toggle = DropdownToggle;

    const DropdownMenu: MockComponent<{ children: ReactNode }> = ({ children }) => <div>{children}</div>;
    DropdownMenu.displayName = 'DropdownMenu';
    Dropdown.Menu = DropdownMenu;

    const DropdownItem: MockComponent<DropdownItemProps> = ({ children, onClick }) => <button onClick={onClick}>{children}</button>;
    DropdownItem.displayName = 'DropdownItem';
    Dropdown.Item = DropdownItem;

    return { ...OriginalModule, Tabs, Tab, Dropdown };
});

// FIX 2: Defined the tab content as named components instead of inline divs.
const Tab1Content = () => <div>Content for Tab 1</div>;
const Tab2Content = () => <div>Content for Tab 2</div>;

const mockTabs = [
    { eventKey: 'tab1', title: 'First Tab', content: <Tab1Content /> },
    { eventKey: 'tab2', title: 'Second Tab', content: <Tab2Content /> },
];

describe('CommonTabs Component', () => {
    const user = userEvent.setup();
    const onTabClickMock = jest.fn();

    beforeEach(() => onTabClickMock.mockClear());

    test('should render tabs and default content correctly', () => {
        render(<CommonTabs tabs={mockTabs} />);
        expect(screen.getByRole('tab', { name: 'First Tab' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Second Tab' })).toBeInTheDocument();
        expect(screen.getByText('Content for Tab 1')).toBeInTheDocument();
        expect(screen.queryByText('Content for Tab 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Status:')).not.toBeInTheDocument();
    });

    test('should switch tabs and call onTabClick with correct arguments', async () => {
        render(<CommonTabs tabs={mockTabs} onTabClick={onTabClickMock} />);
        const secondTabButton = screen.getByRole('tab', { name: 'Second Tab' });
        await user.click(secondTabButton);
        expect(screen.getByText('Content for Tab 2')).toBeInTheDocument();
        expect(screen.queryByText('Content for Tab 1')).not.toBeInTheDocument();
        expect(onTabClickMock).toHaveBeenCalledTimes(1);
        expect(onTabClickMock).toHaveBeenCalledWith('tab2', 'confirmed');
    });

    test('should render the status dropdown when showStatusSelect is true', () => {
        render(<CommonTabs tabs={mockTabs} showStatusSelect />);
        expect(screen.getByText('Status:')).toBeInTheDocument();
    });

    test('should NOT render the status dropdown if headname is "Inventory"', () => {
        render(<CommonTabs tabs={mockTabs} showStatusSelect headname="Inventory" />);
        expect(screen.queryByText('Status:')).not.toBeInTheDocument();
    });

    test('should update status and call onTabClick when a dropdown item is selected', async () => {
        render(<CommonTabs tabs={mockTabs} showStatusSelect onTabClick={onTabClickMock} />);
        const pendingOption = screen.getAllByRole('button', { name: 'Pending' })[0];
        await user.click(pendingOption);
        expect(onTabClickMock).toHaveBeenCalledTimes(1);
        expect(onTabClickMock).toHaveBeenCalledWith('tab1', 'pending');
    });

    test('should use the updated status for subsequent tab clicks', async () => {
        render(<CommonTabs tabs={mockTabs} showStatusSelect onTabClick={onTabClickMock} />);
        const cancelledOption = screen.getByRole('button', { name: 'Cancelled' });
        await user.click(cancelledOption);
        onTabClickMock.mockClear();
        const secondTabButton = screen.getByRole('tab', { name: 'Second Tab' });
        await user.click(secondTabButton);
        expect(onTabClickMock).toHaveBeenCalledTimes(1);
        expect(onTabClickMock).toHaveBeenCalledWith('tab2', 'cancelled');
    });
});

