import React from 'react';

type StatusStyle = {
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
};

/** Column header shared by the appointment and task kanban boards. */
export const BoardColumnHeader = ({
  label,
  count,
  style,
}: {
  label: string;
  count: number;
  style: StatusStyle;
}) => (
  <div
    className="rounded-t-2xl border-b px-3 py-2"
    style={{
      backgroundColor: style.backgroundColor,
      borderBottomColor: style.borderColor,
    }}
  >
    <div className="flex items-center justify-between">
      <div className="text-body-4-emphasis" style={{ color: style.color }}>
        {label}
      </div>
      <div
        className="text-caption-1 rounded-full px-2 py-0.5"
        style={{
          backgroundColor: style.backgroundColor,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: style.borderColor,
          color: style.color,
          opacity: 0.85,
        }}
      >
        {count}
      </div>
    </div>
  </div>
);

/**
 * Attach the dragover/drop listeners a board column needs while a card drag is
 * active: edge auto-scroll on the column and its scroll container, and the drop
 * handler on the column body. Returns the matching removeEventListener cleanups.
 */
export const attachBoardColumnDnDListeners = ({
  dropElement,
  scrollElement,
  isDragActive,
  onDrop,
  autoScrollBoardOnDrag,
}: {
  dropElement: HTMLElement;
  scrollElement: HTMLElement;
  isDragActive: () => boolean;
  onDrop: () => void;
  autoScrollBoardOnDrag: (event: React.DragEvent<HTMLElement>, scrollElement?: HTMLElement) => void;
}): Array<() => void> => {
  const handleColumnDragOver = (event: DragEvent) => {
    if (!isDragActive()) return;
    event.preventDefault();
    autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>);
  };

  const handleColumnDrop = (event: DragEvent) => {
    if (!isDragActive()) return;
    event.preventDefault();
    onDrop();
  };

  const handleScrollDragOver = (event: DragEvent) => {
    if (!isDragActive()) return;
    event.preventDefault();
    autoScrollBoardOnDrag(event as unknown as React.DragEvent<HTMLElement>, scrollElement);
  };

  dropElement.addEventListener('dragover', handleColumnDragOver);
  dropElement.addEventListener('drop', handleColumnDrop);
  scrollElement.addEventListener('dragover', handleScrollDragOver);

  return [
    () => dropElement.removeEventListener('dragover', handleColumnDragOver),
    () => dropElement.removeEventListener('drop', handleColumnDrop),
    () => scrollElement.removeEventListener('dragover', handleScrollDragOver),
  ];
};
