# =============================================================================
# ECS Autoscaling — Frontend, Backend API, and Celery Worker
# Scales on CPU utilization. Each service scales independently.
# =============================================================================

# ─── Frontend Autoscaling ─────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "frontend" {
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.frontend.name}/${aws_ecs_service.frontend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "frontend_cpu" {
  name               = "${var.app_name}-frontend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.frontend.resource_id
  scalable_dimension = aws_appautoscaling_target.frontend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.frontend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ─── Backend API Autoscaling ──────────────────────────────────────────────────

resource "aws_appautoscaling_target" "backend_api" {
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.backend.name}/${aws_ecs_service.backend_api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_api_cpu" {
  name               = "${var.app_name}-backend-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend_api.resource_id
  scalable_dimension = aws_appautoscaling_target.backend_api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend_api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ─── Celery Worker Autoscaling ────────────────────────────────────────────────

resource "aws_appautoscaling_target" "backend_worker" {
  max_capacity       = max(4, var.backend_worker_desired_count + 2)
  min_capacity       = var.backend_worker_desired_count  # pinned to experiment baseline
  resource_id        = "service/${aws_ecs_cluster.backend.name}/${aws_ecs_service.backend_worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_worker_cpu" {
  name               = "${var.app_name}-backend-worker-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend_worker.resource_id
  scalable_dimension = aws_appautoscaling_target.backend_worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend_worker.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
