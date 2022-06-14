# Runtime Infrastructure with Step Functions

This is a sample application for managing infrastructure at runtime, such as creating and deleting CloudFront Distributions. Among the items included as part of the application's infrastructure is an S3 bucket containing a static website which is initially not publicly accessible. To make the website accessible, a request can be made to the application's API to provision a new CloudFront Distribution. Once a distribution is created, the website can be accessed via the distribution's URL.

Note that this is a proof of concept solution. While it does use many AWS best practices (secure infrastructure, input validation, etc.), additional measures are needed before it is production ready:
- API authorization (currently API is publicly accessible)
- AWS WAF Web ACL's to protect endpoints from DDoS
- Full error handling in Step Functions (state machines should have code for handling situations where a step does not run successfully)

## 1. Prerequisites

- NodeJS
- AWS CLI (configured with credentials + region for AWS account)
- AWS CDK Toolkit
- Bootstrapped AWS account / region

The commands in `package.json` leverage the `cdk` executable and do not specify a profile. They will inherently use the `[default]` profile unless otherwise specified by the `AWS_PROFILE` environment variable. For more details, see [this link](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

## 2. Setup

To build the application and deploy it into an AWS account, follow these steps:

1. Clone the repo
1. Open a command line in the repo directory
1. Run command `npm install`
1. Run command `npm run build`
1. Run command `npm run deploy`
    - After running the deploy command, you will be asked to accept IAM changes associated with the CloudFormation template. These changes involve new IAM roles which are created specifically for running the application and will be cleaned up when the stack is deleted.
1. Note the URL of the API Gateway endpoint (referred to as `[API_URL]` in the rest of this document)
    - E.g. https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/ 

## 3. Usage

### 3.1 Summary of Commands

The following is a list of `curl` commands which can be run to exercise the application's API functions:

| Command | Description |
| --- | --- |
| `curl [API_URL]/distribution` | List all distributions sorted by most recently modified (including deleted distributions); returns empty array if no distributions were created | 
| `curl -X POST [API_URL]/distribution/[DISTRIBUTION_ID]` | Create a new distribution (no request body needed); returns the ID of the new distribution | 
| `curl [API_URL]/distribution/[DISTRIBUTION_ID]` | Get the info for a specific distribution; returns a 400 response if distribution with provided ID is not found  | 
| `curl -X DELETE [API_URL]/distribution/[DISTRIBUTION_ID]` | Delete a distribution; returns the ID of the distribution being deleted | 

- *`[API_URL]` is the URL of your application's API Gateway (obtained from the output of the deploy command from setup, or from viewing the Gateway in the AWS console)*
- *`[DISTRIBUTION_ID]` is the ID of a created distribution (specifically the `id`, not the `cloudFrontId`)*

### 3.2 Testing the Application

1. Start by listing the available distributions to verify that no distributions exist yet
1. Create a new distribution
1. List the distributions again to verify one is being created
1. List the distributions until the new one is ready (`status: ACTIVE`)
1. Obtain the `domainName` of the new distribution and attempt to access it from a browser to verify that the website is available
1. Delete the distribution
1. List the distributions until the target has been deleted (`status: DELETED`)
1. Use a browser to visit the distribution's `domainName` again to verify that the website is no longer accessible from that distribution

## 4. Teardown

To remove the application from the AWS account, follow these steps:

***NOTE:** Before proceeding, please delete all CloudFront Distributions which were created using this application. If you delete the stack while some are still active, the stack will fail to delete because the CloudFront Origin Access Identity will still be attached to the distribution(s). You are free to delete the CloudFront Distributions via the API provided by this demo app, or by simply using the AWS console (note that each one must be disabled before being deleted - the app's API will handle that for you).*

1. Open a command line in the repo directory
1. Run command `npm run teardown`

## 5. Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## 6. License

This library is licensed under the MIT-0 License. See the LICENSE file.