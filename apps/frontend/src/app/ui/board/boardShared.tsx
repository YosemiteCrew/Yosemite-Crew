import React from 'react';

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
