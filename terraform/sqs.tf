# Main task queue
resource "aws_sqs_queue" "tasks_dlq" {
  name                       = "${var.app_name}-tasks-dlq"
  message_retention_seconds  = 1209600 # 14 days — max retention for dead letters
  visibility_timeout_seconds = 300

  tags = { Name = "${var.app_name}-tasks-dlq" }
}

resource "aws_sqs_queue" "tasks" {
  name                       = "${var.app_name}-tasks"
  visibility_timeout_seconds = 300  # Must be >= Celery task timeout
  message_retention_seconds  = 86400 # 1 day

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.tasks_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${var.app_name}-tasks" }
}
