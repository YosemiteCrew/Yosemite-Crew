import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CommonTabForBusinessDashboard from '../../../components/CommonTabs/CommonTabForBusinessDashboard';

jest.mock('react-bootstrap', () => {
    const OriginalModule = jest.requireActual('react-bootstrap');

    const Tabs = ({ children, defaultActiveKey, onSelect }: any) => {
        const [activeKey, setActiveKey] = React.useState(defaultActiveKey);
        const tabs = React.Children.toArray(children);
        const activeTab = tabs.find((child: any) => child.props.eventKey === activeKey);
        return (
            <div>
                <div role="tablist">
                    {tabs.map((child: any) => (
                        <button
                            key={child.props.eventKey}
                            role="tab"
                            aria-selected={child.props.eventKey === activeKey}
                            onClick={() => onSelect && onSelect(child.props.eventKey)}
                        >
                            {child.props.title}
                        </button>
                    ))}
                </div>
                <div role="tabpanel">{activeTab}</div>
            </div>
        );
    };
    // Add display names to all mock components
    Tabs.displayName = 'Tabs';

    const Tab = ({ children }: any) => <>{children}</>;
    Tab.displayName = 'Tab';

    const Dropdown = ({ children, onSelect }: any) => {
        const [Toggle, Menu] = React.Children.toArray(children);
        const items = React.Children.map(Menu.props.children, (child: any) =>
            React.cloneElement(child, { onClick: () => onSelect(child.props.eventKey) })
        );
        return <div>{Toggle}{items}</div>;
    };
    Dropdown.displayName = 'Dropdown';

    Dropdown.Toggle = ({ children, id }: any) => <button data-testid={id}>{children}</button>;
    Dropdown.Toggle.displayName = 'Dropdown.Toggle'; // Fix: Added display name

    Dropdown.Menu = ({ children }: any) => <div>{children}</div>;
    Dropdown.Menu.displayName = 'Dropdown.Menu'; // Fix: Added display name

    Dropdown.Item = ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>;
    Dropdown.Item.displayName = 'Dropdown.Item'; // Fix: Added display name

    return { ...OriginalModule, Tabs, Tab, Dropdown };
});

const mockTabs = [
    { eventKey: 'appointments', title: 'Appointments', content: <div>Appointments Content</div> },
    { eventKey: 'revenue', title: 'Revenue', content: <div>Revenue Content</div> },
];

describe('CommonTabForBusinessDashboard Component', () => {
    const user = userEvent.setup();
    const onTabClickMock = jest.fn();

    beforeEach(() => {
        onTabClickMock.mockClear();
    });

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
        render(<CommonTabForBusinessDashboard tabs={mockTabs} showStatusSelect={true} />);

        expect(screen.getByText('Status:')).toBeInTheDocument();
        const dropdownToggle = screen.getByTestId('dropdown-status');
        expect(dropdownToggle).toHaveTextContent('Confirmed');
    });

    test('should update status via dropdown and use it in onTabClick', async () => {
        render(<CommonTabForBusinessDashboard tabs={mockTabs} showStatusSelect={true} onTabClick={onTabClickMock} />);

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