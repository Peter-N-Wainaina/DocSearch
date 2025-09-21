import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Bucket, BlockPublicAccess, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { TableV2, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';

import { Construct } from 'constructs';

import { DEV, PROD} from '../constants';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export interface DocIntakeStackProps extends StackProps {
  environment?: string;
}

export class DocIntakeStack extends Stack {
  public readonly uploadsBucket: Bucket;
  public readonly ocrQueue: Queue;
  public readonly ocrDLQ: Queue;
  public readonly ocrResultsTable: TableV2;
  public readonly processor: PythonFunction;
  
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

    // DDB Table
    this.ocrResultsTable = new TableV2(this, 'OcrResultsTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
    });

    this.processor = new PythonFunction(this, 'ProcessorFn', {
      entry: '../lambdas/ocr/src',
      index: 'processor.py',
      handler: 'handler',
      runtime: Runtime.PYTHON_3_12,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(120),
      memorySize: 1024,
      environment: {
        TABLE_NAME: this.ocrResultsTable.tableName,
        BUCKET_NAME: this.uploadsBucket.bucketName,
      },
    })

    //  SQS → Lambda event source (Lambda auto-polls SQS)
    this.processor.addEventSource(new SqsEventSource(this.ocrQueue, {
      batchSize: 5,
      reportBatchItemFailures: true, // enables partial batch success
    }))

    // Grant permissions
    this.uploadsBucket.grantRead(this.processor);
    this.ocrResultsTable.grantWriteData(this.processor);
    this.processor.addToRolePolicy(new PolicyStatement({
      actions: [
        'textract:DetectDocumentText',
        'textract:StartDocumentTextDetection',
        'textract:GetDocumentTextDetection',
      ],
      resources: ['*'],
    }))

  }
}