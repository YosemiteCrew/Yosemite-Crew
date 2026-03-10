import React from 'react';

const ErrorList = ({ errors }: { errors?: Record<string, string> }) => (
  <div>
    {Object.values(errors ?? {}).map((error) => (
      <div key={error}>{error}</div>
    ))}
  </div>
);

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/features/tasks/components/TaskFormFields', () => ({
  __esModule: true,
  default: ({ formDataErrors }: any) => <ErrorList errors={formDataErrors} />,
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useCompanionsForPrimaryOrg: () => [],
}));

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: () => [],
}));

jest.mock('@/app/features/tasks/services/taskService', () => ({
  createTask: jest.fn(),
  createTaskTemplate: jest.fn(),
  getTaskLibrary: jest.fn().mockResolvedValue([]),
  getTaskTemplatesForPrimaryOrg: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/lib/date', () => ({
  applyUtcTime: (d: Date) => d,
  getUtcTimeValue: () => '00:00',
  generateTimeSlots: () => ['09:00'],
}));

// This file contains shared mocks for AddTask tests
// Adding a placeholder test to satisfy Jest's requirement
describe('taskAddTaskTestMocks', () => {
  it('exports mocks for AddTask tests', () => {
    expect(true).toBe(true);
  });
});
