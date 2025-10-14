import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CommonTabForPractitioners from '../../../components/CommonTabs/CommonTabForPractitioners';

const mockTableProps: any = {};
jest.mock('@/app/components/DataTable/PracticeteamtableForBusinessDashboard', () => {
    // Give the mock component a name
    const MockTable = (props: any) => {
        Object.assign(mockTableProps, props);
        return <div data-testid="mock-table" />;
    };
    // Add the displayName property
    MockTable.displayName = 'MockPracticeteamtableForBusinessDashboard';
    return MockTable;
});

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
                            onClick={() => {
                                setActiveKey(child.props.eventKey);
                                if (onSelect) onSelect(child.props.eventKey);
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
    Dropdown.Toggle.displayName = 'Dropdown.Toggle';

    Dropdown.Menu = ({ children }: any) => <div>{children}</div>;
    Dropdown.Menu.displayName = 'Dropdown.Menu';

    Dropdown.Item = ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>;
    Dropdown.Item.displayName = 'Dropdown.Item';

    return { ...OriginalModule, Tabs, Tab, Dropdown };
});

const mockTabs = [
    { eventKey: 'dept1', title: 'Cardiology' },
    { eventKey: 'dept2', title: 'Neurology' },
];

describe('CommonTabForPractitioners Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        for (const key in mockTableProps) {
            delete mockTableProps[key];
        }
    });

    test('should render tabs and pass default props to the table', () => {
        render(<CommonTabForPractitioners tabs={mockTabs} showStatusSelect={true} />);

        expect(screen.getByRole('tab', { name: 'Cardiology' })).toBeInTheDocument();
        expect(screen.getByTestId('mock-table')).toBeInTheDocument();

        expect(mockTableProps.departmentId).toBe('dept1');
        expect(mockTableProps.role).toBe('all');
    });

    test('should not render dropdown if showStatusSelect is false', () => {
        render(<CommonTabForPractitioners tabs={mockTabs} showStatusSelect={false} />);
        expect(screen.queryByText('Role:')).not.toBeInTheDocument();
    });

    test('should update role and pass it to the table when dropdown selection changes', async () => {
        render(<CommonTabForPractitioners tabs={mockTabs} showStatusSelect={true} />);

        const dropdownToggle = screen.getByTestId('dropdown-status');
        expect(dropdownToggle).toHaveTextContent('All');

        const vetOption = screen.getByRole('button', { name: 'Vet' });
        await user.click(vetOption);

        expect(dropdownToggle).toHaveTextContent('Vet');

        expect(mockTableProps.role).toBe('vet');
        expect(mockTableProps.departmentId).toBe('dept1');
    });

    test('should update departmentId when a new tab is selected', async () => {
        render(<CommonTabForPractitioners tabs={mockTabs} showStatusSelect={true} />);

        expect(mockTableProps.departmentId).toBe('dept1');

        const neurologyTab = screen.getByRole('tab', { name: 'Neurology' });
        await user.click(neurologyTab);

        expect(mockTableProps.departmentId).toBe('dept2');
        expect(mockTableProps.role).toBe('all');
    });
});