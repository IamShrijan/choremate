# ─── Backend Internal ALB ─────────────────────────────────────────────────────
resource "aws_lb" "backend" {
  name               = "${var.app_name}-backend-alb"
  internal           = true # NOT reachable from the internet
  load_balancer_type = "application"
  security_groups    = [aws_security_group.backend_alb.id]
  subnets            = aws_subnet.private[*].id

  enable_deletion_protection = false

  tags = { Name = "${var.app_name}-backend-alb" }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.app_name}-backend-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = { Name = "${var.app_name}-backend-tg" }
}

resource "aws_lb_listener" "backend" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 8000
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# ─── Backend ECS Cluster ─────────────────────────────────────────────────────
resource "aws_ecs_cluster" "backend" {
  name = "${var.app_name}-backend"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${var.app_name}-backend-cluster" }
}

# ─── Backend API Task Definition ─────────────────────────────────────────────
resource "aws_ecs_task_definition" "backend_api" {
  family                   = "${var.app_name}-backend-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_api_cpu
  memory                   = var.backend_api_memory

  # LabRole — no IAM role creation needed in student account
  execution_role_arn = var.lab_role_arn
  task_role_arn      = var.lab_role_arn

  container_definitions = jsonencode([
    {
      name      = "backend-api"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      portMappings = [{ containerPort = 8000, protocol = "tcp" }]

      environment = [
        { name = "WORKER_MODE",        value = "false" },
        { name = "AWS_DEFAULT_REGION", value = var.aws_region },
        { name = "SQS_QUEUE_NAME",     value = aws_sqs_queue.tasks.name },
        { name = "SQS_QUEUE_URL",      value = aws_sqs_queue.tasks.url },
      ]

      secrets = [
        { name = "GEMINI_API_KEY",  valueFrom = aws_ssm_parameter.gemini_api_key.arn },
        { name = "SECRET_KEY",      valueFrom = aws_ssm_parameter.secret_key.arn },
        { name = "ALLOWED_ORIGINS", valueFrom = aws_ssm_parameter.allowed_origins.arn },
        { name = "DATABASE_URL",    valueFrom = aws_ssm_parameter.rds_url.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend_api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend-api"
        }
      }
    }
  ])

  tags = { Name = "${var.app_name}-backend-api-task" }
}

# ─── Backend Celery Worker Task Definition ────────────────────────────────────
resource "aws_ecs_task_definition" "backend_worker" {
  family                   = "${var.app_name}-backend-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_worker_cpu
  memory                   = var.backend_worker_memory

  execution_role_arn = var.lab_role_arn
  task_role_arn      = var.lab_role_arn

  container_definitions = jsonencode([
    {
      name      = "backend-worker"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true

      environment = [
        { name = "WORKER_MODE",        value = "true" },
        { name = "AWS_DEFAULT_REGION", value = var.aws_region },
        { name = "SQS_QUEUE_NAME",     value = aws_sqs_queue.tasks.name },
        { name = "SQS_QUEUE_URL",      value = aws_sqs_queue.tasks.url },
      ]

      secrets = [
        { name = "GEMINI_API_KEY", valueFrom = aws_ssm_parameter.gemini_api_key.arn },
        { name = "SECRET_KEY",     valueFrom = aws_ssm_parameter.secret_key.arn },
        { name = "DATABASE_URL",   valueFrom = aws_ssm_parameter.rds_url.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend_worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend-worker"
        }
      }
    }
  ])

  tags = { Name = "${var.app_name}-backend-worker-task" }
}

# ─── Backend API ECS Service ─────────────────────────────────────────────────
resource "aws_ecs_service" "backend_api" {
  name            = "${var.app_name}-backend-api"
  cluster         = aws_ecs_cluster.backend.id
  task_definition = aws_ecs_task_definition.backend_api.arn
  desired_count   = var.backend_api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.backend_ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend-api"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.backend]

  tags = { Name = "${var.app_name}-backend-api-service" }
}

# ─── Celery Worker ECS Service ───────────────────────────────────────────────
resource "aws_ecs_service" "backend_worker" {
  name            = "${var.app_name}-backend-worker"
  cluster         = aws_ecs_cluster.backend.id
  task_definition = aws_ecs_task_definition.backend_worker.arn
  desired_count   = var.backend_worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.backend_ecs.id]
    assign_public_ip = false
  }

  # Workers don't need an ALB — they pull from SQS directly
  tags = { Name = "${var.app_name}-backend-worker-service" }
}
