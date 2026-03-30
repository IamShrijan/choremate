resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.app_name}/frontend"
  retention_in_days = 7
  tags              = { Name = "${var.app_name}-frontend-logs" }
}

resource "aws_cloudwatch_log_group" "backend_api" {
  name              = "/ecs/${var.app_name}/backend-api"
  retention_in_days = 14
  tags              = { Name = "${var.app_name}-backend-api-logs" }
}

resource "aws_cloudwatch_log_group" "backend_worker" {
  name              = "/ecs/${var.app_name}/backend-worker"
  retention_in_days = 14
  tags              = { Name = "${var.app_name}-backend-worker-logs" }
}
