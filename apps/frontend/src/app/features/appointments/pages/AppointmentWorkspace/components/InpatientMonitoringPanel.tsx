'use client';

import InpatientMonitoringPanelBody, {
  type InpatientMonitoringPanelProps,
} from './InpatientMonitoringPanelBody';

// Remounted for every patient stay, so no loaded observation, open form or typed value can
// carry over from one patient to another while the workspace reuses this component.
const InpatientMonitoringPanel = (props: InpatientMonitoringPanelProps) => (
  <InpatientMonitoringPanelBody
    key={[props.organisationId, props.patientId, props.encounterId].join(':')}
    {...props}
  />
);

export default InpatientMonitoringPanel;
