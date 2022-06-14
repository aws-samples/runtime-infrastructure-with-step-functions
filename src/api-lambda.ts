// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { APIGatewayProxyResult, APIGatewayEvent } from "aws-lambda";
import { handleCreate } from "./api/create-distribution";
import { handleDelete } from "./api/delete-distribution";
import { handleGet } from "./api/get-distribution";
import { handleList } from "./api/list-distributions";
import { validate as uuidValidate } from 'uuid';

/**
 * Lambda handler for receiving API invocations from API Gateway and executing the appropriate business logic
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);

    let statusCode = 400;
    let message = "Unsupported path / method";

    // Only a few valid paths; determine function using conditionals
    // For larger / more complex API's, consider using a framework like 'express'
    try {
        if (event.resource === "/distribution") {
            switch (event.httpMethod) {
            case "POST": {
                const id = await handleCreate();
                message = `Creating distribution with ID ${id}`;
                break;
            }
            case "GET": {
                const dist = await handleList();
                message = JSON.stringify(dist);
                break;
            }
            default:
                break;
            }
        } else if (event.resource === "/distribution/{distributionId}") {
            const id = event.pathParameters["distributionId"];
            if (!uuidValidate(id)) {
                statusCode = 400;
                message = "'distributionId' must be a valid UUID"
            }
            else {
                switch (event.httpMethod) {
                case "DELETE": {
                    await handleDelete(id);
                    message = `Deleting distribution with ID ${id}`;
                    break;
                }
                case "GET": {
                    const dist = await handleGet(id);
                    message = JSON.stringify(dist);
                    break;
                }
                default:
                    break;
                }
            }

        }
    } catch (e) {
        console.error(e);
        statusCode = 500;
        message = e.message;
    }

    return {
        statusCode: statusCode,
        body: message,
    };
};
