# ─── Frontend ALB (internet-facing) ──────────────────────────────────────────
resource "aws_lb" "frontend" {
  name               = "${var.app_name}-frontend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.frontend_alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  # Increase from default 60s — chatbot makes 2-3 sequential Gemini calls (can be 3-5 min).
  # Must be >= Nginx proxy_read_timeout (300s) + some headroom.
  idle_timeout = 350

  tags = { Name = "${var.app_name}-frontend-alb" }
}

resource "aws_lb_target_group" "frontend" {
  name        = "${var.app_name}-frontend-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # Required for Fargate

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "${var.app_name}-frontend-tg" }
}

resource "aws_lb_listener" "frontend_http" {
  load_balancer_arn = aws_lb.frontend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# ─── Frontend ECS Cluster ─────────────────────────────────────────────────────
resource "aws_ecs_cluster" "frontend" {
  name = "${var.app_name}-frontend"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${var.app_name}-frontend-cluster" }
}

# ─── Frontend Task Definition ─────────────────────────────────────────────────
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.app_name}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory

  # Use LabRole — student accounts cannot create IAM roles.
  execution_role_arn = var.lab_role_arn
  task_role_arn      = var.lab_role_arn

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = "${aws_ecr_repository.frontend.repository_url}:latest"
      essential = true

      portMappings = [{ containerPort = 80, protocol = "tcp" }]

      environment = [
        { name = "BACKEND_URL", value = "http://${aws_lb.backend.dns_name}:8000" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    }
  ])

  tags = { Name = "${var.app_name}-frontend-task" }
}

# ─── Frontend ECS Service ────────────────────────────────────────────────────
resource "aws_ecs_service" "frontend" {
  name            = "${var.app_name}-frontend"
  cluster         = aws_ecs_cluster.frontend.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.frontend_ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.frontend_http]

  tags = { Name = "${var.app_name}-frontend-service" }
}
