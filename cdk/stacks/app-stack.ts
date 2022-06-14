// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { aws_dynamodb, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Effect, PolicyStatement, PolicyStatementProps, Role, RoleProps, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { FunctionProps, Code, Runtime, Tracing, Function } from "aws-cdk-lib/aws-lambda";
import { NagSuppressions, NagPackSuppression } from "cdk-nag";
import { Construct } from "constructs";
import { 
    LambdaIntegration, 
    LambdaIntegrationOptions, 
    LogGroupLogDestination,
    MethodLoggingLevel,
    RestApi,
    RestApiProps,
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, LogGroupProps, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Succeed, StateMachine, StateMachineProps, LogOptions, LogLevel, TaskInput, RetryProps, JsonPath } from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke, LambdaInvokeProps } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Attribute, AttributeType, Table, TableProps } from "aws-cdk-lib/aws-dynamodb";
import { BucketProps, BucketEncryption, BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { OriginAccessIdentity, OriginAccessIdentityProps } from "aws-cdk-lib/aws-cloudfront";
import { BucketDeployment, BucketDeploymentProps, Source } from "aws-cdk-lib/aws-s3-deployment";

export const DEFAULT_LOG_RETENTION = RetentionDays.TWO_WEEKS;
export const DEFAULT_REMOVAL_POLICY = RemovalPolicy.DESTROY;

export interface AppStackProps extends StackProps {
    apiFunctionRoleName: string;
}

/**
 * Full stack for deploying the sample application
 */
export class AppStack extends Stack {
    DistributionPrefix: string;

    ApiFunctionRole: Role;
    ApiFunction: Function; // eslint-disable-line @typescript-eslint/ban-types

    StateMachineFunctionRole: Role;
    StateMachineFunction: Function; // eslint-disable-line @typescript-eslint/ban-types

    ApiGateway: RestApi;

    StateMachineCreateRole: Role;
    StateMachineCreate: StateMachine;

    StateMachineDeleteRole: Role;
    StateMachineDelete: StateMachine;

    Database: aws_dynamodb.Table;
    WebsiteBucket: Bucket;
    OriginAccessIdentity: OriginAccessIdentity;
    WebsiteBucketDeploymentRole: Role;

    constructor(scope: Construct, id: string, props?: AppStackProps) {
        super(scope, id, props);

        this.DistributionPrefix = `${this.stackName}-Distribution-`;

        this.BuildApiFunction();
        this.BuildStateMachineFunction();
        this.BuildApiGateway();
        this.BuildStateMachineCreate();
        this.BuildStateMachineDelete();
        this.BuildDatabase();
        this.BuildWebsiteBucket();
        this.SetLambdaEnvironmentVars();
    }

    /**
     * Builds the API Lambda function and associated IAM role
     */
    private BuildApiFunction() {
        // Role
        const apiFunctionRoleName = `${this.stackName}-Role-ApiFunction`;
        this.ApiFunctionRole = new Role(this, apiFunctionRoleName, <RoleProps>{
            roleName: apiFunctionRoleName,
            assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        });

        this.ApiFunctionRole.addToPrincipalPolicy(
            new PolicyStatement(<PolicyStatementProps>{
                sid: "EnableCloudWatchLogging",
                effect: Effect.ALLOW,
                actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
                resources: ["*"],
            }),
        );

        // Function
        const apiFunctionName = `${this.stackName}-Function-Api`;
        this.ApiFunction = new Function(this, apiFunctionName, <FunctionProps>{
            functionName: apiFunctionName,
            role: this.ApiFunctionRole,
            code: Code.fromAsset("./dist/api"),
            handler: "api-lambda.handler",
            runtime: Runtime.NODEJS_16_X,
            memorySize: 512,
            timeout: Duration.minutes(10),
            logRetention: DEFAULT_LOG_RETENTION,
            logRetentionRole: this.ApiFunctionRole,
            tracing: Tracing.ACTIVE,
        });

        // CDK Nag suppressions
        NagSuppressions.addResourceSuppressions(
            this.ApiFunctionRole,
            [
                <NagPackSuppression>{
                    id: "AwsSolutions-IAM5",
                    reason: "Wildcard used so the logging retention custom resource (a separate Lambda created from 'logRetention' property) can also write logs",
                },
            ],
            true,
        );
    }

    /**
     * Builds the state machine Lambda function and associate role
     */
    private BuildStateMachineFunction() {
        // Role
        const stateMachineFunctionRoleName = `${this.stackName}-Role-StateMachineFunction`;
        this.StateMachineFunctionRole = new Role(this, stateMachineFunctionRoleName, <RoleProps>{
            roleName: stateMachineFunctionRoleName,
            assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        });

        this.StateMachineFunctionRole.addToPrincipalPolicy(
            new PolicyStatement(<PolicyStatementProps>{
                sid: "EnableCloudWatchLogging",
                effect: Effect.ALLOW,
                actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
                resources: ["*"],
            }),
        );
        this.StateMachineFunctionRole.addToPrincipalPolicy(
            new PolicyStatement(<PolicyStatementProps>{
                sid: "AllowCloudFrontAccess",
                effect: Effect.ALLOW,
                actions: [
                    "cloudfront:UpdateDistribution",
                    "cloudfront:DeleteDistribution",
                    "cloudfront:CreateDistribution",
                    "cloudfront:GetDistribution",
                    "cloudfront:ListCachePolicies",
                    "cloudfront:ListResponseHeadersPolicies",
                ],
                resources: ["*"],
            }),
        );

        // Function
        const stateMachineFunctionName = `${this.stackName}-Function-StateMachine`;
        this.StateMachineFunction = new Function(this, stateMachineFunctionName, <FunctionProps>{
            functionName: stateMachineFunctionName,
            role: this.StateMachineFunctionRole,
            code: Code.fromAsset("./dist/state-machine"),
            handler: "state-machine-lambda.handler",
            runtime: Runtime.NODEJS_16_X,
            memorySize: 512,
            timeout: Duration.minutes(10),
            logRetention: DEFAULT_LOG_RETENTION,
            logRetentionRole: this.StateMachineFunctionRole,
            tracing: Tracing.ACTIVE,
        });

        // CDK Nag suppressions
        NagSuppressions.addResourceSuppressions(
            this.StateMachineFunctionRole,
            [
                <NagPackSuppression>{
                    id: "AwsSolutions-IAM5",
                    reason: "Wildcard used so the logging retention custom resource (a separate Lambda created from 'logRetention' property) can also write logs",
                },
            ],
            true,
        );
    }

    /**
     * Builds the API Gateway, API paths, and API Gateway log group
     */
    private BuildApiGateway() {
        // Logs
        const logName = `${this.stackName}-ApiGatewayLogs`;
        const logGroup = new LogGroup(this, logName, <LogGroupProps>{
            logGroupName: logName,
            retention: DEFAULT_LOG_RETENTION,
            removalPolicy: DEFAULT_REMOVAL_POLICY,
        });

        // API Gateway
        const apiGatewayName = `${this.stackName}-ApiGateway`;
        this.ApiGateway = new RestApi(this, apiGatewayName, <RestApiProps>{
            restApiName: apiGatewayName,
            deployOptions: {
                stageName: "dev",
                accessLogDestination: new LogGroupLogDestination(logGroup),
                loggingLevel: MethodLoggingLevel.ERROR,
            },
        });

        // Resources
        const distributions = this.ApiGateway.root.addResource("distribution");
        const distribution = distributions.addResource("{distributionId}");

        // POST for creating a distribution
        distributions.addMethod("POST", new LambdaIntegration(this.ApiFunction, <LambdaIntegrationOptions>{ proxy: true }));

        // GET for listing all distributions + status
        distributions.addMethod("GET", new LambdaIntegration(this.ApiFunction, <LambdaIntegrationOptions>{ proxy: true }));

        // GET for retrieving specific distribution
        distribution.addMethod("GET", new LambdaIntegration(this.ApiFunction, <LambdaIntegrationOptions>{ proxy: true }));

        // DELETE for deleting a distribution
        distribution.addMethod("DELETE", new LambdaIntegration(this.ApiFunction, <LambdaIntegrationOptions>{ proxy: true }));

        // CDK Nag suppressions
        NagSuppressions.addResourceSuppressions(
            this.ApiGateway,
            [
                <NagPackSuppression>{ id: "AwsSolutions-APIG2", reason: "Validation of inputs performed within the Lambda function" },
                <NagPackSuppression>{ id: "AwsSolutions-APIG3", reason: "WAF Web ACL not used for this demo application" },
                <NagPackSuppression>{ id: "AwsSolutions-APIG4", reason: "Authorization not used for this demo application" },
                <NagPackSuppression>{ id: "AwsSolutions-COG4", reason: "Authorization not used for this demo application" },
                <NagPackSuppression>{ 
                    id: "AwsSolutions-IAM4",
                    reason: "AmazonAPIGatewayPushToCloudWatchLogs is automatically added enabling logging for API Gateway; low risk for using this managed policy",
                },
            ],
            true,
        );
    }

    /**
     * Builds the Step Function state machine used for creating a CloudFront Distribution
     */
    private BuildStateMachineCreate() {
        // Role
        const stateMachineRoleName = `${this.stackName}-Role-StateMachineCreate`;
        this.StateMachineCreateRole = new Role(this, stateMachineRoleName, <RoleProps>{
            roleName: stateMachineRoleName,
            assumedBy: new ServicePrincipal(`states.${this.region}.amazonaws.com`),
        });
        this.StateMachineFunction.grantInvoke(this.StateMachineCreateRole);

        // Logs
        const logName = `${this.stackName}-StateMachineLogs-Create`;
        const logGroup = new LogGroup(this, logName, <LogGroupProps>{
            logGroupName: logName,
            retention: DEFAULT_LOG_RETENTION,
            removalPolicy: DEFAULT_REMOVAL_POLICY,
        });
        logGroup.grantWrite(this.StateMachineCreateRole);

        // Steps
        const createDistributionStep = new LambdaInvoke(this, `${this.stackName}-CreateStep-CreateDistribution`, <LambdaInvokeProps>{
            lambdaFunction: this.StateMachineFunction,
            payload: TaskInput.fromObject({
                requestType: "Create",
                "distributionId.$": "$.distributionId",
            }),
            resultPath: JsonPath.DISCARD,
        });
        const verifyReadyStep = new LambdaInvoke(this, `${this.stackName}-CreateStep-VerifyDistributionReady`, <LambdaInvokeProps>{
            lambdaFunction: this.StateMachineFunction,
            payload: TaskInput.fromObject({
                requestType: "VerifyReady",
                "distributionId.$": "$.distributionId",
            }),
            resultPath: JsonPath.DISCARD,
        });
        verifyReadyStep.addRetry(<RetryProps>{
            errors: ["States.TaskFailed"],
            interval: Duration.seconds(30),
            maxAttempts: 30,
            backoffRate: 1,
        });
        const successStep = new Succeed(this, `${this.stackName}-CreateStep-Success`);

        // prettier-ignore
        const chain = createDistributionStep
            .next(verifyReadyStep)
            .next(successStep);

        // State Machine
        const stateMachineName = `${this.stackName}-StateMachine-Create`;
        this.StateMachineCreate = new StateMachine(this, stateMachineName, <StateMachineProps>{
            stateMachineName: stateMachineName,
            role: this.StateMachineCreateRole,
            definition: chain,
            logs: <LogOptions>{
                level: LogLevel.ALL,
                destination: logGroup,
            },
            tracingEnabled: true,
        });
        this.StateMachineCreate.grantStartExecution(this.ApiFunction);

        // CDK Nag suppressions
        NagSuppressions.addResourceSuppressions(
            this.StateMachineCreateRole,
            [<NagPackSuppression>{ id: "AwsSolutions-IAM5", reason: "Wildcard automatically added when granting permission for resource to invoke Lambda" }],
            true,
        );
    }

    /**
     * Builds the Step Function state machine for deleting a CloudFront Distribution
     */
    private BuildStateMachineDelete() {
        // Role
        const stateMachineRoleName = `${this.stackName}-Role-StateMachineDelete`;
        this.StateMachineDeleteRole = new Role(this, stateMachineRoleName, <RoleProps>{
            roleName: stateMachineRoleName,
            assumedBy: new ServicePrincipal(`states.${this.region}.amazonaws.com`),
        });
        this.StateMachineFunction.grantInvoke(this.StateMachineDeleteRole);

        // Logs
        const logName = `${this.stackName}-StateMachineLogs-Delete`;
        const logGroup = new LogGroup(this, logName, <LogGroupProps>{
            logGroupName: logName,
            retention: DEFAULT_LOG_RETENTION,
            removalPolicy: DEFAULT_REMOVAL_POLICY,
        });
        logGroup.grantWrite(this.StateMachineDeleteRole);

        // Steps
        const disableStep = new LambdaInvoke(this, `${this.stackName}-DeleteStep-DisableDistribution`, <LambdaInvokeProps>{
            lambdaFunction: this.StateMachineFunction,
            payload: TaskInput.fromObject({
                requestType: "Disable",
                "distributionId.$": "$.distributionId",
            }),
            resultPath: JsonPath.DISCARD,
        });
        const verifyDisabledStep = new LambdaInvoke(this, `${this.stackName}-DeleteStep-VerifyDistributionDisabled`, <LambdaInvokeProps>{
            lambdaFunction: this.StateMachineFunction,
            payload: TaskInput.fromObject({
                requestType: "VerifyDisabled",
                "distributionId.$": "$.distributionId",
            }),
            resultPath: JsonPath.DISCARD,
        });
        verifyDisabledStep.addRetry(<RetryProps>{
            errors: ["States.TaskFailed"],
            interval: Duration.seconds(30),
            maxAttempts: 30,
            backoffRate: 1,
        });
        const deleteDistributionStep = new LambdaInvoke(this, `${this.stackName}-DeleteStep-DeleteDistribution`, <LambdaInvokeProps>{
            lambdaFunction: this.StateMachineFunction,
            payload: TaskInput.fromObject({
                requestType: "Delete",
                "distributionId.$": "$.distributionId",
            }),
            resultPath: JsonPath.DISCARD,
        });
        const successStep = new Succeed(this, `${this.stackName}-DeleteStep-Success`);

        // prettier-ignore
        const chain = disableStep
            .next(verifyDisabledStep)
            .next(deleteDistributionStep)
            .next(successStep);

        // State Machine
        const stateMachineName = `${this.stackName}-StateMachine-Delete`;
        this.StateMachineDelete = new StateMachine(this, stateMachineName, <StateMachineProps>{
            stateMachineName: stateMachineName,
            role: this.StateMachineDeleteRole,
            definition: chain,
            logs: <LogOptions>{
                level: LogLevel.ALL,
                destination: logGroup,
            },
            tracingEnabled: true,
        });
        this.StateMachineDelete.grantStartExecution(this.ApiFunction);

        // CDK Nag suppressions
        NagSuppressions.addResourceSuppressions(
            this.StateMachineDeleteRole,
            [<NagPackSuppression>{ id: "AwsSolutions-IAM5", reason: "Wildcard automatically added when granting permission for resource to invoke Lambda" }],
            true,
        );
    }

    /**
     * Builds the database for storing metadata about CloudFront Distributions
     */
    private BuildDatabase() {
        // Database
        const databaseName = `${this.stackName}-Database`;
        this.Database = new Table(this, databaseName, <TableProps>{
            tableName: databaseName,
            partitionKey: <Attribute>{
                name: "id",
                type: AttributeType.STRING,
            },
            removalPolicy: DEFAULT_REMOVAL_POLICY
        });

        const databaseAccessPolicy = new PolicyStatement({
            sid: "EnableDatabaseAccess",
            effect: Effect.ALLOW,
            actions: [
                "dynamodb:BatchGetItem",
                "dynamodb:DescribeTable",
                "dynamodb:GetItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchWriteItem",
                "dynamodb:DeleteItem",
                "dynamodb:UpdateItem",
                "dynamodb:PutItem",
            ],
            resources: [this.Database.tableArn, `${this.Database.tableArn}/*`],
        });

        this.ApiFunctionRole.addToPolicy(databaseAccessPolicy);
        this.StateMachineFunctionRole.addToPolicy(databaseAccessPolicy);

        // CDK Nag suppressions
        NagSuppressions.addResourceSuppressions(this.Database, [
            <NagPackSuppression>{ id: "AwsSolutions-DDB3", reason: "Table recovery not enabled for demo application" },
        ]);
    }

    /**
     * Builds the S3 Bucket which hosts the simple static website (only accessible via a CloudFront Distribution)
     */
    private BuildWebsiteBucket() {
        // Logging
        const loggingBucket = new Bucket(this, `${this.stackName}-WebBucketLogs`, <BucketProps>{
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            lifecycleRules: [
                {
                    expiration: Duration.days(DEFAULT_LOG_RETENTION),
                },
            ],
            removalPolicy: DEFAULT_REMOVAL_POLICY,
            autoDeleteObjects: true,
            enforceSSL: true,
        });

        // Website Bucket
        this.WebsiteBucket = new Bucket(this, `${this.stackName}-WebBucket`, <BucketProps>{
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            lifecycleRules: [
                {
                    expiration: Duration.days(DEFAULT_LOG_RETENTION),
                },
            ],
            removalPolicy: DEFAULT_REMOVAL_POLICY,
            autoDeleteObjects: true,
            enforceSSL: true,
            serverAccessLogsBucket: loggingBucket,
        });

        // Website Bucket deployment role
        const roleName = `${this.stackName}-Role-WebsiteBucketDeployment`;
        this.WebsiteBucketDeploymentRole = new Role(this, roleName, <RoleProps>{
            roleName: roleName,
            assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        });

        // Website Bucket deployment
        new BucketDeployment(this, `${this.stackName}-WebBucketDeployment`, <BucketDeploymentProps>{
            sources: [Source.asset("./web")],
            destinationBucket: this.WebsiteBucket,
            role: this.WebsiteBucketDeploymentRole,
        });

        // Origin Access Identity for Website Bucket
        const identityName = `${this.stackName}-WebBucketIdentity`;
        this.OriginAccessIdentity = new OriginAccessIdentity(this, identityName, <OriginAccessIdentityProps>{
            comment: identityName,
        });

        this.WebsiteBucket.addToResourcePolicy(
            new PolicyStatement({
                sid: "GrantReadToOriginAccessIdentity",
                effect: Effect.ALLOW,
                actions: ["s3:GetObject"],
                resources: [`${this.WebsiteBucket.bucketArn}/*`],
                principals: [this.OriginAccessIdentity.grantPrincipal],
            }),
        );

        // CDK Nag suppressions
        NagSuppressions.addResourceSuppressions(
            loggingBucket,
            [<NagPackSuppression>{ id: "AwsSolutions-S1", reason: "Logs are disabled because this is a bucket for receiving logs" }],
            true,
        );
        NagSuppressions.addResourceSuppressions(
            this.WebsiteBucket,
            [
                <NagPackSuppression>{ id: "AwsSolutions-S3", reason: "This bucket contains files for a public website; encryption at rest not needed" },
                <NagPackSuppression>{ id: "AwsSolutions-S10", reason: "This bucket does not enforce SSL because CloudFront must access via plain HTTP" },
            ],
            true,
        );
        NagSuppressions.addResourceSuppressions(
            this.WebsiteBucketDeploymentRole,
            [
                <NagPackSuppression>{
                    id: "AwsSolutions-IAM5",
                    reason: "This resource uses a CDK-generated policy for accessing objects in the target bucket; policy is only used for the deployment object",
                },
            ],
            true,
        );
        const buckedDeploymentCustomResource = this.node.children.find(c => c.node.id.includes("CDKBucketDeployment"));
        NagSuppressions.addResourceSuppressions(
            buckedDeploymentCustomResource,
            [
                <NagPackSuppression>{ 
                    id: "AwsSolutions-L1",
                    reason: "The bucket deployment utilizes a Lambda custom resource under the hood; the runtime version is managed by the construct", 
                },
            ],
            false,
        );
    }

    /**
     * Sets the environment variables for each Lambda function
     */
    private SetLambdaEnvironmentVars() {
        // API Function env vars
        this.ApiFunction.addEnvironment("DatabaseTableName", this.Database.tableName);
        this.ApiFunction.addEnvironment("StateMachineCreateArn", this.StateMachineCreate.stateMachineArn);
        this.ApiFunction.addEnvironment("StateMachineDeleteArn", this.StateMachineDelete.stateMachineArn);

        // State Machine Function env vars
        this.StateMachineFunction.addEnvironment("DatabaseTableName", this.Database.tableName);
        this.StateMachineFunction.addEnvironment("WebsiteBucketRegionalDomainName", this.WebsiteBucket.bucketRegionalDomainName);
        this.StateMachineFunction.addEnvironment("OriginAccessIdentityId", this.OriginAccessIdentity.originAccessIdentityName);
        this.StateMachineFunction.addEnvironment("DistributionPrefix", this.DistributionPrefix);
    }
}
