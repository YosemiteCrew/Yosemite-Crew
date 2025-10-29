type AmplifyOutputs = {
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
  // Extend with additional categories as needed.
};

declare module '*/amplify_outputs.json' {
  const outputs: AmplifyOutputs;
  export default outputs;
}

declare module '*.json' {
  const value: any;
  export default value;
}
