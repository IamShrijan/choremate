output "frontend_alb_dns" {
  description = "Public DNS name of the frontend ALB — open this in your browser"
  value       = aws_lb.frontend.dns_name
}

output "frontend_alb_url" {
  description = "Full URL for the frontend application"
  value       = "http://${aws_lb.frontend.dns_name}"
}

output "backend_alb_dns" {
  description = "Internal DNS of the backend ALB (only reachable from within the VPC)"
  value       = aws_lb.backend.dns_name
}

output "frontend_ecr_url" {
  description = "ECR repository URL for the frontend image"
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_url" {
  description = "ECR repository URL for the backend image"
  value       = aws_ecr_repository.backend.repository_url
}

output "sqs_queue_url" {
  description = "SQS queue URL for the Celery broker"
  value       = aws_sqs_queue.tasks.url
}

output "efs_id" {
  description = "EFS file system ID (for mounting in ECS tasks)"
  value       = aws_efs_file_system.backend_data.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (host:port)"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_db_name" {
  description = "RDS database name"
  value       = aws_db_instance.postgres.db_name
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint for the SSE notification bus"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "redis_url" {
  description = "Full Redis URL injected into ECS tasks via SSM"
  value       = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379/0"
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "push_commands" {
  description = "Docker push commands to deploy new images"
  value = <<-EOT
    # Authenticate Docker to ECR
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.frontend.repository_url}

    # Frontend
    docker build -t ${aws_ecr_repository.frontend.repository_url}:latest ./choremate-app
    docker push ${aws_ecr_repository.frontend.repository_url}:latest

    # Backend
    docker build -t ${aws_ecr_repository.backend.repository_url}:latest ./backend
    docker push ${aws_ecr_repository.backend.repository_url}:latest

    # Force ECS re-deploy
    aws ecs update-service --cluster ${aws_ecs_cluster.frontend.name} --service choremate-frontend --force-new-deployment --region ${var.aws_region}
    aws ecs update-service --cluster ${aws_ecs_cluster.backend.name} --service choremate-backend-api --force-new-deployment --region ${var.aws_region}
    aws ecs update-service --cluster ${aws_ecs_cluster.backend.name} --service choremate-backend-worker --force-new-deployment --region ${var.aws_region}
  EOT
}
