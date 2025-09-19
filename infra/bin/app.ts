#!/usr/bin/env node
import { App } from 'aws-cdk-lib';

import { DocIntakeStack } from '../lib/doc-intake-stack';
import { DEV } from '../constants';

const app = new App()

// Create the Doc Intake stack for development
new DocIntakeStack(app, 'doc-intake-dev', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  environment: DEV,
})
