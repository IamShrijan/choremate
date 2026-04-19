# ─── RDS Subnet Group ────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name        = "${var.app_name}-db-subnet-group"
  description = "Subnet group for Choremate RDS instance"
  subnet_ids  = aws_subnet.private[*].id

  tags = { Name = "${var.app_name}-db-subnet-group" }
}

# ─── RDS PostgreSQL Instance ──────────────────────────────────────────────────
resource "aws_db_instance" "postgres" {
  identifier        = "${var.app_name}-db"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.rds_instance_class
  allocated_storage = 20
  storage_type      = "gp2"
  storage_encrypted = true

  db_name  = var.rds_db_name
  username = var.rds_username
  password = var.rds_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Keep the DB private — no public endpoint
  publicly_accessible = false

  # Free-tier eligible: single-AZ, no multi-AZ (set to true for production HA)
  multi_az = false

  # Backups
  # Note: Set to 0 to bypass Free Tier backup limitations. Set to 7 in production.
  backup_retention_period = 0
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:05:00-sun:06:00"

  # Prevent Terraform from destroying the DB on every apply
  deletion_protection       = false # Set true in production
  skip_final_snapshot       = true  # Set false in production
  final_snapshot_identifier = "${var.app_name}-final-snapshot"

  tags = { Name = "${var.app_name}-postgres" }
}

# ─── SSM param with the full connection URL ───────────────────────────────────
# Stored separately so the password never appears in ECS task def plaintext.
resource "aws_ssm_parameter" "rds_url" {
  name  = "/${var.app_name}/DATABASE_URL"
  type  = "SecureString"
  value = "postgresql://${var.rds_username}:${var.rds_password}@${aws_db_instance.postgres.endpoint}/${var.rds_db_name}"

  tags = { Name = "${var.app_name}-rds-url" }

  lifecycle {
    # Prevent accidental overwrite of a manually updated password
    ignore_changes = [value]
  }
}
