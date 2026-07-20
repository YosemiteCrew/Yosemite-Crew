import React from 'react';
import {ViewTouchField} from './ViewField';

interface ViewDateTimeRowProps {
  dateLabel: string;
  dateValue: string;
  timeLabel: string;
  timeValue: string;
}

/**
 * Date + time as two stacked warm-bone detail rows inside a detail group card.
 */
export const ViewDateTimeRow: React.FC<ViewDateTimeRowProps> = ({
  dateLabel,
  dateValue,
  timeLabel,
  timeValue,
}) => (
  <>
    <ViewTouchField label={dateLabel} value={dateValue} />
    <ViewTouchField label={timeLabel} value={timeValue} />
  </>
);
