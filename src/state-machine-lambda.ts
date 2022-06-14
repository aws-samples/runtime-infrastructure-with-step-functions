// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { createDistribution } from "./state-machine/create-distribution";
import { deleteDistribution } from "./state-machine/delete-distribution";
import { disableDistribution } from "./state-machine/disable-distribution";
import { verifyDistributionDisabled } from "./state-machine/verify-distribution-disabled";
import { verifyDistributionReady } from "./state-machine/verify-distribution-ready";

/**
 * Lambda handler for receiving events from a Step Function and executing the appropriate business logic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any): Promise<void> => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    switch (event.requestType) {
    case "Create":
        await createDistribution(event.distributionId);
        break;
    case "VerifyReady":
        await verifyDistributionReady(event.distributionId);
        break;
    case "Disable":
        await disableDistribution(event.distributionId);
        break;
    case "VerifyDisabled":
        await verifyDistributionDisabled(event.distributionId);
        break;
    case "Delete":
        await deleteDistribution(event.distributionId);
        break;
    }
};
