// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CloudFront } from "aws-sdk";
import { DeleteDistributionRequest, GetDistributionRequest } from "aws-sdk/clients/cloudfront";
import { DistributionDatabase, DistributionStatus } from "../common/database";

/**
 * Handles state machine step for deleting the CloudFront Distribution
 */
export async function deleteDistribution(distId: string): Promise<void> {
    try {
        const database = new DistributionDatabase();
        const dist = await database.GetDistribution(distId);

        console.info("Getting distribution...");
        const client = new CloudFront();
        const getDistResponse = await client
            .getDistribution(<GetDistributionRequest>{
                Id: dist.cloudFrontId,
            })
            .promise();
        console.info("Distribution retrieved");

        console.info("Deleting distribution...");
        await client
            .deleteDistribution(<DeleteDistributionRequest>{
                Id: dist.cloudFrontId,
                IfMatch: getDistResponse.ETag,
            })
            .promise();
        console.info("Distribution deletion initiated");
    } catch (e) {
        console.error(e);
        throw new Error("Error deleting distribution");
    }

    console.info("Updating database...");
    try {
        const database = new DistributionDatabase();
        const dist = await database.GetDistribution(distId);
        const currentTime = new Date().toISOString();
        dist.updatedAt = currentTime;
        dist.status = DistributionStatus.Deleted;
        await database.UpdateDistribution(dist);
    } catch (e) {
        console.error(e);
        throw new Error("Error updating distribution in database");
    }
    console.info("Database updated");
}
