# EFS File System for SQLite persistence across ECS tasks
resource "aws_efs_file_system" "backend_data" {
  creation_token   = "${var.app_name}-backend-efs"
  performance_mode = "generalPurpose"
  throughput_mode  = "bursting"
  encrypted        = true

  tags = { Name = "${var.app_name}-backend-efs" }

  lifecycle {
    prevent_destroy = false # Set to true in production to guard against accidental deletion
  }
}

# Mount targets — one per private subnet
resource "aws_efs_mount_target" "backend" {
  count           = length(aws_subnet.private)
  file_system_id  = aws_efs_file_system.backend_data.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs.id]
}

# Access point — restricts container to /data inside the EFS volume
resource "aws_efs_access_point" "backend" {
  file_system_id = aws_efs_file_system.backend_data.id

  posix_user {
    gid = 1000
    uid = 1000
  }

  root_directory {
    path = "/data"

    creation_info {
      owner_gid   = 1000
      owner_uid   = 1000
      permissions = "755"
    }
  }

  tags = { Name = "${var.app_name}-efs-ap" }
}
