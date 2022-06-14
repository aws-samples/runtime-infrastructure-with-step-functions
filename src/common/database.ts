// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as dynamoose from "dynamoose";
import { Document } from "dynamoose/dist/Document";
import { ModelType } from "dynamoose/dist/General";

/**
 * Enum for valid states of a distribution
 */
export enum DistributionStatus {
    Creating = "CREATING",
    Active = "ACTIVE",
    Disabling = "DISABLING",
    Disabled = "DISABLED",
    Deleted = "DELETED",
}

/**
 * Metadata for a distribution
 */
export interface Distribution {
    id: string;
    domainName: string;
    cloudFrontId: string;
    status: DistributionStatus;
    createdAt: string;
    updatedAt: string;
}

/**
 * Database model for the distribution
 */
class DistributionItem extends Document implements Distribution {
    id: string;
    domainName: string;
    cloudFrontId: string;
    status: DistributionStatus;
    createdAt: string;
    updatedAt: string;
}

/**
 * Schema for the database table
 */
const schema = new dynamoose.Schema({
    id: String,
    domainName: String,
    cloudFrontId: String,
    status: String,
    createdAt: String,
    updatedAt: String,
});

/**
 * Class for interacting with the database that stores distribution metadata
 */
export class DistributionDatabase {
    model: ModelType<DistributionItem>;

    constructor() {
        const tableName = process.env["DatabaseTableName"];
        this.model = dynamoose.model<DistributionItem>(tableName, schema);
    }

    /**
     * Add metadata for a new distribution
     */
    public async InsertDistribution(dist: Distribution): Promise<void> {
        await this.model.create(dist);
    }

    /**
     * Update metadata for an existing distribution
     */
    public async UpdateDistribution(dist: Distribution): Promise<void> {
        await this.model.update(dist);
    }

    /**
     * Get metadata for a distribution
     */
    public async GetDistribution(id: string): Promise<Distribution> {
        const dist = await this.model.get(id);
        return dist as Distribution;
    }

    /**
     * List metadata for all distributions
     */
    public async ListDistributions(): Promise<Distribution[]> {
        // Using scan (rather than query) because distributions are the only thing in the example table
        const dists = await this.model.scan().exec();
        return dists as Distribution[];
    }
}
