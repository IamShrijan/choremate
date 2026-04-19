# ─── ElastiCache Subnet Group ────────────────────────────────────────────────
# Reuse the same private subnets as RDS and ECS
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.app_name}-redis-subnet-group"
  description = "Private subnets for the Choremate Redis SSE notification bus"
  subnet_ids  = aws_subnet.private[*].id

  tags = { Name = "${var.app_name}-redis-subnet-group" }
}

# ─── ElastiCache Redis Cluster (single-node) ─────────────────────────────────
#
# Role: SSE notification fanout bus (publish_notification_sync → Redis PUBLISH).
#       NOT used as Celery broker — that stays on SQS.
#
# Sizing: cache.t3.micro (~$13/month) is sufficient; Redis pub/sub is
#         extremely lightweight (only tiny "ping" signals are published).
#
# Multi-AZ / clustering: disabled for cost.  To enable HA:
#   - Set num_cache_clusters = 2  (primary + one replica)
#   - Or switch to aws_elasticache_replication_group with automatic_failover
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.app_name}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.elasticache_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # Disable at-rest encryption for lowest latency (pub/sub data is transient).
  # Enable for production-grade compliance: at_rest_encryption_enabled = true
  snapshot_retention_limit = 0 # No persistence needed — pub/sub is ephemeral

  tags = { Name = "${var.app_name}-redis" }
}
