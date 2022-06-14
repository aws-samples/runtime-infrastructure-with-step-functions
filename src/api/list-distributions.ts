// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Distribution, DistributionDatabase } from "../common/database";

/**
 * Handles a request to list the distributions
 */
export async function handleList(): Promise<Distribution[]> {
    let dists: Distribution[] = null;

    try {
        const database = new DistributionDatabase();
        dists = await database.ListDistributions();
        dists.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (e) {
        console.error(e);
        throw new Error("Error retrieving distributions from database");
    }

    return dists;
}
