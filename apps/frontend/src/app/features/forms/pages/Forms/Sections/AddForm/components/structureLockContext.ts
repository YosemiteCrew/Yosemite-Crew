import React from 'react';

/**
 * When true, the template structure is locked (YC-default ownership): builder controls
 * that change structure — add/remove/delete/move/reorder and the medication/task pickers —
 * are hidden at every nesting level, while field content stays editable. Provided by Build
 * and consumed by BuilderWrapper plus the nested group builders.
 */
export const StructureLockContext = React.createContext(false);
