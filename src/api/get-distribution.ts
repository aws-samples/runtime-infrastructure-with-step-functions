// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Distribution, DistributionDatabase } from "../common/database";

/**
 * Handles a request to get a distribution's information
 */
export async function handleGet(distId: string): Promise<Distribution> {
    let dist = null;

    try {
        const database = new DistributionDatabase();
        dist = await database.GetDistribution(distId);
    } catch (e) {
        console.error(e);
        throw new Error(`Error retrieving distribution ${distId} from database`);
    }

    return dist;
}
