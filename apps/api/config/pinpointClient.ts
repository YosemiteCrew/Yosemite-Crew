import { PinpointClient } from '@aws-sdk/client-pinpoint';

const REGION = process.env.AWS_REGION || 'eu-central-1';

const pinClient = new PinpointClient({ region: REGION });

export default pinClient;
