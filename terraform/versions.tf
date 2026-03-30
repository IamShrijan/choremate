terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }

  # Remote state — uncomment and fill in once you have an S3 bucket.
  # For a student account you can create an S3 bucket manually and use it here.
  # backend "s3" {
  #   bucket         = "choremate-tfstate"
  #   key            = "choremate/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}
