import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Bucket, BlockPublicAccess, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { DEV, PROD} from '../constants';

export interface DocIntakeStackProps extends StackProps {
  environment?: string;
}

export class DocIntakeStack extends Stack {
  public readonly uploadsBucket: Bucket;
  public readonly ocrQueue: Queue;
  public readonly ocrDLQ: Queue;

  
  constructor(scope: Construct, id: string, props?: DocIntakeStackProps) {
    super(scope, id, props);

    // S3 bucket for document uploads
    const isProd = props?.environment === PROD;
    this.uploadsBucket = new Bucket(this, 'UploadsBucket', {
      bucketName: `doc-intake-uploads-${props?.environment || DEV}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      versioned: false, // Can enable later for production
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [HttpMethods.PUT, HttpMethods.POST],
          allowedOrigins: ['http://localhost:5173'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // DLQ for upload events
    this.ocrDLQ = new Queue(this, 'ocrDLQ',{
      queueName: `ocrDLQ${props?.environment ||  DEV}`
      }
    );

    // SQS Queue for upload events
    this.ocrQueue = new Queue(this, 'ocrQueue', {
      queueName: `ocrQueue${props?.environment || DEV}`,
      visibilityTimeout: Duration.minutes(5),
      deadLetterQueue: {
        queue: this.ocrDLQ,
        maxReceiveCount: 5,
      }
    })

  }
}