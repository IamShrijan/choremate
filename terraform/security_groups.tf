# ─── Frontend ALB Security Group ─────────────────────────────────────────────
# Accepts HTTP from anyone on the internet
resource "aws_security_group" "frontend_alb" {
  name        = "${var.app_name}-frontend-alb-sg"
  description = "Allow HTTP inbound to the public frontend ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.app_name}-frontend-alb-sg" }
}

# ─── Frontend ECS Security Group ────────────────────────────────────────────
# Accepts traffic from the frontend ALB only
resource "aws_security_group" "frontend_ecs" {
  name        = "${var.app_name}-frontend-ecs-sg"
  description = "Allow inbound only from the frontend ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP from frontend ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.frontend_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.app_name}-frontend-ecs-sg" }
}

# ─── Backend ALB Security Group ──────────────────────────────────────────────
# Internal ALB — accepts traffic from frontend ECS tasks only
resource "aws_security_group" "backend_alb" {
  name        = "${var.app_name}-backend-alb-sg"
  description = "Allow inbound from the frontend ECS SG only (internal)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API traffic from frontend ECS tasks"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.frontend_ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.app_name}-backend-alb-sg" }
}

# ─── Backend ECS Security Group ──────────────────────────────────────────────
# Accepts from the internal backend ALB; also allows EFS NFS traffic within SG
resource "aws_security_group" "backend_ecs" {
  name        = "${var.app_name}-backend-ecs-sg"
  description = "Backend ECS tasks: allow from backend ALB and EFS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API traffic from backend internal ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_alb.id]
  }

  egress {
    description = "All outbound (SQS, Gemini API, ECR pull, EFS)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.app_name}-backend-ecs-sg" }
}

# ─── EFS Security Group ──────────────────────────────────────────────────────
resource "aws_security_group" "efs" {
  name        = "${var.app_name}-efs-sg"
  description = "Allow NFS from backend ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "NFS from backend ECS"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.app_name}-efs-sg" }
}

# ─── RDS Security Group ───────────────────────────────────────────────────────
# PostgreSQL only accessible from backend ECS tasks — not from the internet, not from frontend
resource "aws_security_group" "rds" {
  name        = "${var.app_name}-rds-sg"
  description = "Allow PostgreSQL from backend ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from backend ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.app_name}-rds-sg" }
}

# ─── Redis (ElastiCache) Security Group ────────────────────────────────────────
# Port 6379 only reachable from backend ECS tasks (API + worker).
# The SSE pub/sub bus only needs internal VPC access — never internet-facing.
resource "aws_security_group" "redis" {
  name        = "${var.app_name}-redis-sg"
  description = "Allow Redis (6379) from backend ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from backend ECS API and worker tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.app_name}-redis-sg" }
}

