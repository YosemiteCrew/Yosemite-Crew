declare module './amplify_outputs.json' {
  const outputs: {
    auth?: {
      user_pool_id: string;
      aws_region: string;
      user_pool_client_id: string;
      identity_pool_id: string;
    };
    geo?: {
      amazon_location_service: {
        region: string;
      };
    };
    // Add other properties as needed based on your Amplify configuration
  };
  export default outputs;
}
