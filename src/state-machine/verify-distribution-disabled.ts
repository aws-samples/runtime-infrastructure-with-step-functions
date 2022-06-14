// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CloudFront } from "aws-sdk";
import { GetDistributionRequest } from "aws-sdk/clients/cloudfront";
import { DistributionDatabase, DistributionStatus } from "../common/database";

/**
 * Handles state machine step for validating that a CloudFront Distribution is disabled
 */
export async function verifyDistributionDisabled(distId: string): Promise<void> {
    let distStatus = "";
    let distEnabled = true;

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

        distStatus = getDistResponse.Distribution.Status;
        distEnabled = getDistResponse.Distribution.DistributionConfig.Enabled;
    } catch (e) {
        console.error(e);
        throw new Error("Error getting distribution status");
    }

    if (distEnabled || distStatus !== "Deployed") {
        throw new Error(`Expected distribution to be disabled and Deployed, but is currently ${distEnabled ? "enabled" : "disabled"} and ${distStatus}`);
    }

    console.info("Updating database...");
    try {
        const database = new DistributionDatabase();
        const dist = await database.GetDistribution(distId);
        const currentTime = new Date().toISOString();
        dist.updatedAt = currentTime;
        dist.status = DistributionStatus.Disabled;
        await database.UpdateDistribution(dist);
    } catch (e) {
        console.error(e);
        throw new Error("Error updating distribution in database");
    }
    console.info("Database updated");
}
