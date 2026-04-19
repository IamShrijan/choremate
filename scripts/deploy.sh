#!/bin/bash
set -e

# Default settings
USE_MOCK="false"
VITE_BUILD_CMD="npm run build"
TF_VAR_use_mock_llm="false"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --mock) USE_MOCK="true"; VITE_BUILD_CMD="npm run build:mock"; TF_VAR_use_mock_llm="true"; shift ;;
        -h|--help) 
            echo "Usage: ./deploy.sh [--mock]"
            echo "  --mock    Deploys the frontend with mock API enabled and configures the backend to simulate LLM responses via the Celery worker."
            exit 0
            ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
done

cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo "============================================="
echo " Deploying ChoreMate Architecture "
if [ "$USE_MOCK" = "true" ]; then
    echo " 🧪 MOCK MODE ENABLED (Frontend & Backend)"
else
    echo " 🚀 PRODUCTION MODE (Real API & Gemini LLM)"
fi
echo "============================================="

# Add brew to PATH if missing
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# 1. Get exact ECR Repository URLs from Terraform output
cd $PROJECT_ROOT/terraform
FRONTEND_REPO=$(terraform output -raw frontend_ecr_url || echo "")
BACKEND_REPO=$(terraform output -raw backend_ecr_url || echo "")

if [[ -z "$FRONTEND_REPO" ]] || [[ "$FRONTEND_REPO" == *"rror"* ]] || [[ "$FRONTEND_REPO" == *"not found"* ]]; then
    echo "ERROR: Could not retrieve frontend_ecr_url from terraform output. Did you run 'terraform apply'?"
    exit 1
fi
AWS_REGION=$(terraform output -raw push_commands | grep ecs | head -1 | awk '{print $NF}')
if [ -z "$AWS_REGION" ]; then
    AWS_REGION="us-east-1"
fi

echo "[1/4] Authenticating with AWS ECR in region $AWS_REGION..."
ECR_REGISTRY=$(echo $FRONTEND_REPO | cut -d'/' -f1)
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

echo "[2/4] Building and pushing Docker images..."

# Build Frontend (injecting build command if --mock is passed)
echo "Building Frontend with cmd: $VITE_BUILD_CMD"
docker build --build-arg BUILD_CMD="$VITE_BUILD_CMD" -t ${FRONTEND_REPO}:latest $PROJECT_ROOT/choremate-app
docker push ${FRONTEND_REPO}:latest

# Build Backend
echo "Building Backend..."
docker build -t ${BACKEND_REPO}:latest $PROJECT_ROOT/backend
docker push ${BACKEND_REPO}:latest

echo "[3/4] Applying Terraform Infrastructure Updates..."
# This will update the ECS task definitions immediately if mock settings changed
terraform apply -auto-approve -var="use_mock_llm=${TF_VAR_use_mock_llm}"

echo "[4/4] Forcing ECS Service Rollouts to pick up the new Docker images..."
FRONTEND_CLUSTER=$(terraform state show aws_ecs_cluster.frontend | grep name | head -1 | awk '{print $3}' | tr -d '"')
BACKEND_CLUSTER=$(terraform state show aws_ecs_cluster.backend | grep name | head -1 | awk '{print $3}' | tr -d '"')

aws ecs update-service --cluster $FRONTEND_CLUSTER --service choremate-frontend --force-new-deployment --region $AWS_REGION > /dev/null
aws ecs update-service --cluster $BACKEND_CLUSTER --service choremate-backend-api --force-new-deployment --region $AWS_REGION > /dev/null
aws ecs update-service --cluster $BACKEND_CLUSTER --service choremate-backend-worker --force-new-deployment --region $AWS_REGION > /dev/null

echo "============================================="
echo "✅ Deployment Complete!"
echo "It may take 1-2 minutes for ECS to rotate the containers."
FRONTEND_URL=$(terraform output -raw frontend_alb_url)
echo "🌍 App URL: $FRONTEND_URL"
echo "============================================="
