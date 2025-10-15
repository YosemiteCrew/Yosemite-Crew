import React, { ReactElement, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CommonTabForBusinessDashboard from '../../../components/CommonTabs/CommonTabForBusinessDashboard';

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
    type DropdownProps = { children: ReactNode; onSelect?: (eventKey: string | null) => void };

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
                return React.cloneElement(child, { onClick: () => onSelect?.(child.props.eventKey ?? null) });
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

    const DropdownToggle: MockComponent<{ children: ReactNode; id?: string }> = ({ children, id }) => (
        <button data-testid={id}>{children}</button>
    );
    Dropdown.Toggle = DropdownToggle;

    const DropdownMenu: MockComponent<{ children: ReactNode }> = ({ children }) => <div>{children}</div>;
    Dropdown.Menu = DropdownMenu;

    const DropdownItem: MockComponent<DropdownItemProps> = ({ children, onClick }) => (
        <button onClick={onClick}>{children}</button>
    );
    Dropdown.Item = DropdownItem;

    return { ...OriginalModule, Tabs, Tab, Dropdown };
});

const mockTabs = [
    { eventKey: 'appointments', title: 'Appointments', content: <div>Appointments Content</div> },
    { eventKey: 'revenue', title: 'Revenue', content: <div>Revenue Content</div> },
];

describe('CommonTabForBusinessDashboard Component', () => {
    const user = userEvent.setup();
    const onTabClickMock = jest.fn();

    beforeEach(() => onTabClickMock.mockClear());

    test('should render tabs and default content', () => {
        render(<CommonTabForBusinessDashboard tabs={mockTabs} />);
        expect(screen.getByRole('tab', { name: 'Appointments' })).toBeInTheDocument();
        expect(screen.getByText('Appointments Content')).toBeInTheDocument();
    });

    test('should switch tabs and call onTabClick with correct status', async () => {
        render(<CommonTabForBusinessDashboard tabs={mockTabs} onTabClick={onTabClickMock} />);
        await user.click(screen.getByRole('tab', { name: 'Revenue' }));
        expect(onTabClickMock).toHaveBeenCalledWith('revenue', 'confirmed');
    });

    test('should render the status dropdown when showStatusSelect is true', () => {
        render(<CommonTabForBusinessDashboard tabs={mockTabs} showStatusSelect />);
        expect(screen.getByText('Status:')).toBeInTheDocument();
        const dropdownToggle = screen.getByTestId('dropdown-status');
        expect(dropdownToggle).toHaveTextContent('Confirmed');
    });

    test('should update status via dropdown and use it in onTabClick', async () => {
        render(<CommonTabForBusinessDashboard tabs={mockTabs} showStatusSelect onTabClick={onTabClickMock} />);
        const pendingOption = screen.getByRole('button', { name: 'Pending' });
        await user.click(pendingOption);
        expect(onTabClickMock).toHaveBeenCalledWith('appointments', 'pending');
        const dropdownToggle = screen.getByTestId('dropdown-status');
        expect(dropdownToggle).toHaveTextContent('Pending');
        onTabClickMock.mockClear();
        await user.click(screen.getByRole('tab', { name: 'Revenue' }));
        expect(onTabClickMock).toHaveBeenCalledWith('revenue', 'pending');
    });
});
