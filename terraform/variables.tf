variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name prefix used for all resource names"
  type        = string
  default     = "choremate"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

# ─── LabRole ─────────────────────────────────────────────────────────────────
variable "lab_role_arn" {
  description = "ARN of the existing LabRole (AWS Academy accounts cannot create IAM roles)"
  type        = string
  # Override this in terraform.tfvars or set TF_VAR_lab_role_arn
  # Typically: arn:aws:iam::<account_id>:role/LabRole
  default     = ""
}

# ─── Networking ──────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones to use (2 minimum for ALB)"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# ─── ECS ─────────────────────────────────────────────────────────────────────
variable "frontend_cpu" {
  description = "Fargate CPU units for frontend task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Fargate memory (MB) for frontend task"
  type        = number
  default     = 512
}

variable "backend_api_cpu" {
  description = "Fargate CPU units for backend API task"
  type        = number
  default     = 512
}

variable "backend_api_memory" {
  description = "Fargate memory (MB) for backend API task"
  type        = number
  default     = 1024
}

variable "backend_worker_cpu" {
  description = "Fargate CPU units for Celery worker task"
  type        = number
  default     = 512
}

variable "backend_worker_memory" {
  description = "Fargate memory (MB) for Celery worker task"
  type        = number
  default     = 1024
}

variable "frontend_desired_count" {
  description = "Number of frontend ECS tasks to run"
  type        = number
  default     = 2
}

variable "backend_api_desired_count" {
  description = "Number of backend API ECS tasks to run"
  type        = number
  default     = 2
}

variable "backend_worker_desired_count" {
  description = "Number of Celery worker ECS tasks to run"
  type        = number
  default     = 2
}

# ─── Secrets (set in terraform.tfvars, never commit real values) ─────────────
variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
  default     = "REPLACE_ME"
}

variable "secret_key" {
  description = "JWT secret key for the FastAPI backend"
  type        = string
  sensitive   = true
  default     = "REPLACE_ME_WITH_RANDOM_STRING"
}

# ─── RDS ─────────────────────────────────────────────────────────────────────
variable "rds_instance_class" {
  description = "RDS instance class (db.t3.micro is free-tier eligible)"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "choremate"
}

variable "rds_username" {
  description = "RDS master username"
  type        = string
  default     = "chorematadmin"
}

variable "rds_password" {
  description = "RDS master password — set via TF_VAR_rds_password or terraform.tfvars, never hardcode"
  type        = string
  sensitive   = true
  default     = "REPLACE_ME_STRONG_PASSWORD"
}

# ─── ElastiCache (Redis) ──────────────────────────────────────────────────────
variable "elasticache_node_type" {
  description = "ElastiCache node type for the Redis SSE notification bus"
  type        = string
  # cache.t3.micro ≈ $13/month — sufficient for pub/sub signal-only workload.
  # Upgrade to cache.t3.small if you add caching or session storage later.
  default     = "cache.t3.micro"
}

variable "use_mock_llm" {
  description = "Set to true to bypass Gemini and use a mocked LLM sleep in the Celery worker"
  type        = string
  default     = "false"
}
