#!/bin/bash
# Initialise LocalStack SQS queues on startup
set -e

echo "Creating SQS queues in LocalStack..."

awslocal sqs create-queue \
  --queue-name choremate-tasks-dlq \
  --region us-east-1

DLQ_URL=$(awslocal sqs get-queue-url \
  --queue-name choremate-tasks-dlq \
  --region us-east-1 \
  --query QueueUrl \
  --output text)

DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --query Attributes.QueueArn \
  --output text)

awslocal sqs create-queue \
  --queue-name choremate-tasks \
  --region us-east-1 \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}"

echo "SQS queues created:"
awslocal sqs list-queues --region us-east-1
