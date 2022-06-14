// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { StepFunctions } from "aws-sdk";
import { StartExecutionInput } from "aws-sdk/clients/stepfunctions";
import { v4 as generateId } from "uuid";

/**
 * Handles a request to create a new distribution
 */
export async function handleCreate(): Promise<string> {
    const distId = generateId();

    try {
        const client = new StepFunctions();
        await client
            .startExecution(<StartExecutionInput>{
                stateMachineArn: process.env["StateMachineCreateArn"],
                name: `Create_${distId}_${new Date().getTime()}`,
                input: JSON.stringify({
                    distributionId: distId,
                }),
            })
            .promise();
    } catch (e) {
        console.error(e);
        throw new Error("Error initiating distribution creation");
    }

    return distId;
}
