import AWS from 'aws-sdk';
import { config as dotenvConfig } from 'dotenv-esm';
import { env } from '../utils/utils.js';

dotenvConfig();

const endpoint = new AWS.Endpoint(env('S3_ENDPOINT'));

export const s3 = new AWS.S3({
	endpoint,
	accessKeyId: env('S3_ACCESS_KEY_ID'),
	secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
	region: env('S3_REGION'),
	signatureVersion: 'v4',
	s3ForcePathStyle: true,
});
