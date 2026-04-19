# Secrets stored as SSM SecureString — only ECS tasks with LabRole can read them

resource "aws_ssm_parameter" "gemini_api_key" {
  name        = "/${var.app_name}/GEMINI_API_KEY"
  description = "Google Gemini API key for the Choremate backend"
  type        = "SecureString"
  value       = var.gemini_api_key

  tags = { Name = "${var.app_name}-gemini-api-key" }

  lifecycle {
    ignore_changes = [value] # Do not overwrite with "REPLACE_ME" on re-apply
  }
}

resource "aws_ssm_parameter" "secret_key" {
  name        = "/${var.app_name}/SECRET_KEY"
  description = "JWT signing secret for the FastAPI backend"
  type        = "SecureString"
  value       = var.secret_key

  tags = { Name = "${var.app_name}-secret-key" }

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "sqs_queue_url" {
  name        = "/${var.app_name}/SQS_QUEUE_URL"
  description = "SQS queue URL for the Celery broker"
  type        = "String"
  value       = aws_sqs_queue.tasks.url

  tags = { Name = "${var.app_name}-sqs-queue-url" }
}

resource "aws_ssm_parameter" "allowed_origins" {
  name        = "/${var.app_name}/ALLOWED_ORIGINS"
  description = "Comma-separated CORS allowed origins for the backend"
  type        = "String"
  value       = "http://${aws_lb.frontend.dns_name}"

  tags = { Name = "${var.app_name}-allowed-origins" }
}

# ─── Redis URL (SSE notification bus) ─────────────────────────────────────────
# Built from the ElastiCache cluster endpoint after apply.
# Stored as SecureString so it is not visible in ECS task definition plaintext.
resource "aws_ssm_parameter" "redis_url" {
  name        = "/${var.app_name}/REDIS_URL"
  description = "Redis URL for the SSE notification pub/sub bus"
  type        = "SecureString"
  value       = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379/0"

  tags = { Name = "${var.app_name}-redis-url" }

  lifecycle {
    # If the cluster endpoint changes (e.g. after cluster replacement),
    # re-apply will update this automatically unless ignored.
    ignore_changes = []
  }
}

