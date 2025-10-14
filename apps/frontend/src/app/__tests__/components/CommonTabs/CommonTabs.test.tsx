import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CommonTabs from '../../../components/CommonTabs/CommonTabs';

jest.mock('react-bootstrap', () => {
    const OriginalModule = jest.requireActual('react-bootstrap');

    const MockTabs = ({ children, defaultActiveKey, onSelect }: any) => {
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
                            onClick={() => {
                                setActiveKey(child.props.eventKey);
                                if (onSelect) onSelect(child.props.eventKey);
                            }}
                        >
                            {child.props.title}
                        </button>
                    ))}
                </div>
                <div role="tabpanel">{activeTab && activeTab.props.children}</div>
            </div>
        );
    };
    MockTabs.displayName = 'MockTabs';

    const MockTab = ({ children }: any) => <div>{children}</div>;
    MockTab.displayName = 'MockTab';

    const MockDropdown = ({ children, onSelect }: any) => {
        const [Toggle, Menu] = React.Children.toArray(children);
        const items = React.Children.map(Menu.props.children, (child: any) =>
            React.cloneElement(child, { onClick: () => onSelect(child.props.eventKey) })
        );
        return <div>{Toggle}{items}</div>;
    };
    MockDropdown.displayName = 'MockDropdown';

    // FIX: Add display names to all anonymous mock components
    MockDropdown.Toggle = ({ children }: any) => <button>{children}</button>;
    MockDropdown.Toggle.displayName = 'MockDropdown.Toggle';

    MockDropdown.Menu = ({ children }: any) => <div>{children}</div>;
    MockDropdown.Menu.displayName = 'MockDropdown.Menu';

    MockDropdown.Item = ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>;
    MockDropdown.Item.displayName = 'MockDropdown.Item';


    return {
        ...OriginalModule,
        Tabs: MockTabs,
        Tab: MockTab,
        Dropdown: MockDropdown,
    };
});

const mockTabs = [
    { eventKey: 'tab1', title: 'First Tab', content: <div>Content for Tab 1</div> },
    { eventKey: 'tab2', title: 'Second Tab', content: <div>Content for Tab 2</div> },
];

describe('CommonTabs Component', () => {
    const user = userEvent.setup();
    const onTabClickMock = jest.fn();

    beforeEach(() => {
        onTabClickMock.mockClear();
    });

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
        render(<CommonTabs tabs={mockTabs} showStatusSelect={true} />);

        expect(screen.getByText('Status:')).toBeInTheDocument();
    });

    test('should NOT render the status dropdown if headname is "Inventory"', () => {
        render(<CommonTabs tabs={mockTabs} showStatusSelect={true} headname="Inventory" />);

        expect(screen.queryByText('Status:')).not.toBeInTheDocument();
    });

    test('should update status and call onTabClick when a dropdown item is selected', async () => {
        render(<CommonTabs tabs={mockTabs} showStatusSelect={true} onTabClick={onTabClickMock} />);

        const pendingOption = screen.getAllByRole('button', { name: 'Pending' })[0];
        await user.click(pendingOption);

        expect(onTabClickMock).toHaveBeenCalledTimes(1);
        expect(onTabClickMock).toHaveBeenCalledWith('tab1', 'pending');
    });

    test('should use the updated status for subsequent tab clicks', async () => {
        render(<CommonTabs tabs={mockTabs} showStatusSelect={true} onTabClick={onTabClickMock} />);

        const cancelledOption = screen.getByRole('button', { name: 'Cancelled' });
        await user.click(cancelledOption);

        onTabClickMock.mockClear();

        const secondTabButton = screen.getByRole('tab', { name: 'Second Tab' });
        await user.click(secondTabButton);

        expect(onTabClickMock).toHaveBeenCalledTimes(1);
        expect(onTabClickMock).toHaveBeenCalledWith('tab2', 'cancelled');
    });
});