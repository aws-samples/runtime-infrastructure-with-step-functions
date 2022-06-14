// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { StepFunctions } from "aws-sdk";
import { StartExecutionInput } from "aws-sdk/clients/stepfunctions";

/**
 * Handles a request to delete a distribution
 */
export async function handleDelete(distId: string): Promise<void> {
    try {
        const client = new StepFunctions();
        await client
            .startExecution(<StartExecutionInput>{
                stateMachineArn: process.env["StateMachineDeleteArn"],
                name: `Delete_${distId}_${new Date().getTime()}`,
                input: JSON.stringify({
                    distributionId: distId,
                }),
            })
            .promise();
    } catch (e) {
        console.error(e);
        throw new Error(`Error initiating distribution deletion for ${distId}`);
    }
}
