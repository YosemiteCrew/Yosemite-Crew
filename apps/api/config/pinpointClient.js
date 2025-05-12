const { PinpointClient } = require('@aws-sdk/client-pinpoint')
// Set the AWS Region.
const REGION = process.env.AWS_REGION;

const pinClient = new PinpointClient({ region: REGION });

module.exports = { pinClient } 
