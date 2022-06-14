// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { App, Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { AppStack } from "./stacks/app-stack";

const app = new App();
new AppStack(app, "RuntimeInfraDemo");

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
app.synth();
