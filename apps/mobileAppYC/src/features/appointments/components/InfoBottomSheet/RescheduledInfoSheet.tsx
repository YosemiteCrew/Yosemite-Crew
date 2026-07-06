import React from 'react';
import InfoBottomSheet, {type InfoBottomSheetRef} from './InfoBottomSheet';

export const RescheduledInfoSheet = ({
  onClose,
  ref,
}: {onClose?: () => void} & {ref?: React.Ref<InfoBottomSheetRef>}) => (
  <InfoBottomSheet
    ref={ref}
    title="Appointment rescheduled"
    message="We will notify you once the organisation accepts your request."
    cta="Close"
    onCta={onClose}
  />
);

export default RescheduledInfoSheet;
