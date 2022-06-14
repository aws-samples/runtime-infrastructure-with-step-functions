// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { CloudFront } from "aws-sdk";
import {
    AllowedMethods,
    CreateDistributionRequest,
    DefaultCacheBehavior,
    DistributionConfig,
    ListCachePoliciesRequest,
    ListResponseHeadersPoliciesRequest,
    Origin,
    Origins,
    S3OriginConfig,
} from "aws-sdk/clients/cloudfront";
import { Distribution, DistributionDatabase, DistributionStatus } from "../common/database";

/**
 * Handles state machine step for creating the CloudFront Distribution
 */
export async function createDistribution(distId: string): Promise<string> {
    console.info("Deploying distribution...");
    const dist = await deployCloudFrontDistribution(distId);
    console.info("Distribution deployed");

    console.info("Updating database...");
    try {
        const database = new DistributionDatabase();
        await database.InsertDistribution(dist);
    } catch (e) {
        console.error(e);
        throw new Error("Error inserting distribution into database");
    }
    console.info("Database updated");

    return distId;
}

/**
 * Creates the CloudFront Distribution in the AWS account
 */
async function deployCloudFrontDistribution(distId: string): Promise<Distribution> {
    try {
        const client = new CloudFront();

        const bucketRegionalDomainName = process.env["WebsiteBucketRegionalDomainName"];
        const originId = `${process.env["DistributionPrefix"]}${distId}`;

        const responseHeadersPolicies = await client.listResponseHeadersPolicies(<ListResponseHeadersPoliciesRequest>{ Type: "managed" }).promise();
        const securityHeaderPolicyName = "Managed-CORS-and-SecurityHeadersPolicy";
        const securityHeaderPolicy = responseHeadersPolicies.ResponseHeadersPolicyList?.Items?.find(
            policy => policy.ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name === securityHeaderPolicyName,
        )?.ResponseHeadersPolicy;
        if (!securityHeaderPolicy) {
            console.warn(`Could not find the response header policy with name ${securityHeaderPolicyName}`);
        }

        const cachePolicies = await client.listCachePolicies(<ListCachePoliciesRequest>{ Type: "managed" }).promise();
        const cachePolicyName = "Managed-CachingOptimized";
        const cachePolicy = cachePolicies.CachePolicyList.Items.find(policy => policy.CachePolicy.CachePolicyConfig.Name === cachePolicyName)?.CachePolicy;
        if (!cachePolicy) {
            console.warn(`Could not find the cache policy with the name ${cachePolicyName}`);
        }
        console.info(process.env["OriginAccessIdentityName"]);

        const createResponse = await client
            .createDistribution(<CreateDistributionRequest>{
                DistributionConfig: <DistributionConfig>{
                    CallerReference: distId,
                    Comment: `Dynamically generated distribution: ${distId}`,
                    DefaultRootObject: "index.html",
                    Origins: <Origins>{
                        Quantity: 1,
                        Items: [
                            <Origin>{
                                Id: originId,
                                DomainName: bucketRegionalDomainName,
                                S3OriginConfig: <S3OriginConfig>{
                                    OriginAccessIdentity: `origin-access-identity/cloudfront/${process.env["OriginAccessIdentityId"]}`,
                                },
                            },
                        ],
                    },
                    DefaultCacheBehavior: <DefaultCacheBehavior>{
                        TargetOriginId: originId,
                        ViewerProtocolPolicy: "redirect-to-https",
                        AllowedMethods: <AllowedMethods>{
                            Quantity: 2,
                            Items: ["GET", "HEAD"],
                        },
                        CachePolicyId: cachePolicy.Id,
                        ResponseHeadersPolicyId: securityHeaderPolicy.Id,
                    },
                    Enabled: true,
                },
            })
            .promise();

        const currentTime = new Date().toISOString();
        return <Distribution>{
            id: distId,
            domainName: createResponse.Distribution.DomainName,
            cloudFrontId: createResponse.Distribution.Id,
            status: DistributionStatus.Creating,
            createdAt: currentTime,
            updatedAt: currentTime,
        };
    } catch (e) {
        console.error(e);
        throw new Error("Error initiating distribution creation");
    }
}
