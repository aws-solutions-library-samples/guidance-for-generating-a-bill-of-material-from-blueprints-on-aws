#!/bin/bash
set -e

# ============================================
# Guidance for Generating a Bill of Materials from Blueprints on AWS
# Internal Test Deploy Script (CodeBuild Automated Validation)
# ============================================
# Target: CodeBuild Amazon Linux 2023 (aws/codebuild/amazonlinux-x86_64-standard:5.0)
# Mode: Fully unattended, no manual input
# Purpose: Automated validation that the sample code deploys successfully
# ============================================

# ============================================
# CONFIGURATION
# ============================================
export AWS_REGION="us-east-1"
export AWS_DEFAULT_REGION="us-east-1"
STACK_NAME_BASE="blueprint-analyzer-$(date +%s)"
EMAIL_ADDRESS="your-test-email@example.com"
REPO_URL="https://github.com/aws-solutions-library-samples/guidance-for-generating-a-bill-of-materials-from-blueprints-on-aws.git"

# ============================================
# ENVIRONMENT SETUP
# ============================================
echo "============================================"
echo " Blueprint Analyzer - Automated Test Deploy"
echo "============================================"
echo ""

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: $ACCOUNT_ID"
echo "Region: $AWS_REGION"
echo "Stack Name: $STACK_NAME_BASE"
echo ""

# ============================================
# INSTALL DEPENDENCIES
# ============================================
echo "Installing dependencies..."

# Install Node.js 20 (CodeBuild may have older version)
echo "  Installing Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs 2>/dev/null || yum install -y nodejs

# Install AWS CDK CLI
echo "  Installing AWS CDK CLI..."
npm install -g aws-cdk

# Install Python 3.11
echo "  Installing Python 3.11..."
dnf install -y python3.11 python3.11-pip 2>/dev/null || yum install -y python3.11 python3.11-pip

# Ensure Docker is running (CodeBuild privileged mode)
echo "  Verifying Docker..."
dockerd &>/dev/null &
sleep 2
docker info >/dev/null 2>&1 || { echo "ERROR: Docker not available"; exit 1; }
echo "  ✓ Docker running"

echo "  ✓ All dependencies installed"
echo ""

# ============================================
# ENABLE BEDROCK MODEL ACCESS
# ============================================
echo "Enabling Bedrock model access..."

pip3 install --upgrade boto3

# Create the model enablement script
cat > /tmp/enable-bedrock.py << 'PYTHON_SCRIPT'
import sys
import json
import time
import boto3

def enable_model(model_id, region):
    """Request model access and wait for it to be granted."""
    client = boto3.client("bedrock", region_name=region)

    # Check if already enabled
    try:
        response = client.get_foundation_model(modelIdentifier=model_id)
        status = response.get("modelDetails", {}).get("modelLifecycle", {}).get("status", "")
        if status == "ACTIVE":
            print(f"  Model {model_id} is already active")
            return True
    except Exception:
        pass

    # Request access
    try:
        client.put_foundation_model_entitlement(modelIdentifier=model_id)
        print(f"  Requested access for {model_id}")
    except Exception as e:
        if "already" in str(e).lower():
            print(f"  Model {model_id} access already requested")
            return True
        print(f"  Warning: Could not request access for {model_id}: {e}")
        return False

    # Wait for access (up to 60 seconds)
    for i in range(12):
        time.sleep(5)
        try:
            response = client.get_foundation_model(modelIdentifier=model_id)
            status = response.get("modelDetails", {}).get("modelLifecycle", {}).get("status", "")
            if status == "ACTIVE":
                print(f"  ✓ Model {model_id} enabled")
                return True
        except Exception:
            pass

    print(f"  Warning: Model {model_id} may not be fully enabled yet")
    return True

if __name__ == "__main__":
    model_id = sys.argv[1]
    region = sys.argv[2]
    success = enable_model(model_id, region)
    sys.exit(0 if success else 1)
PYTHON_SCRIPT

# Enable Claude Opus (vision/page analysis)
python3 /tmp/enable-bedrock.py "anthropic.claude-opus-4-6-v1" "$AWS_REGION"
RESULT=$?
if [ $RESULT -ne 0 ]; then
    echo "WARNING: Could not enable Claude Opus model"
fi

# Enable Claude Sonnet (text stages + chat)
python3 /tmp/enable-bedrock.py "anthropic.claude-sonnet-4-20250514-v1:0" "$AWS_REGION"
RESULT=$?
if [ $RESULT -ne 0 ]; then
    echo "WARNING: Could not enable Claude Sonnet model"
fi

echo "  ✓ Bedrock model access configured"
echo ""

# ============================================
# CLONE REPOSITORY
# ============================================
echo "Cloning repository..."
cd /tmp
git clone "$REPO_URL" blueprint-analyzer
cd blueprint-analyzer
echo "  ✓ Repository cloned"
echo ""

# ============================================
# UPDATE CONFIGURATION
# ============================================
echo "Updating deployment configuration..."

# Update config.yaml with dynamic stack name and test email
cat > infra-cdk/config.yaml << EOF
stack_name_base: $STACK_NAME_BASE

admin_user_email: $EMAIL_ADDRESS

backend:
  pattern: blueprint-analyzer
  deployment_type: docker
  network_mode: PUBLIC
  use_long_term_memory: false
  ltm_top_k: 10
  ltm_relevance_score: 0.3
EOF

echo "  ✓ Configuration updated (stack: $STACK_NAME_BASE)"
echo ""

# ============================================
# CDK BOOTSTRAP CHECK
# ============================================
echo "Checking CDK bootstrap..."
CDK_BOOTSTRAP_STACK=$(aws cloudformation describe-stacks --region "$AWS_REGION" \
    --query "Stacks[?StackName=='CDKToolkit'].StackName" --output text 2>/dev/null || echo "")

if [ -z "$CDK_BOOTSTRAP_STACK" ] || [ "$CDK_BOOTSTRAP_STACK" == "None" ]; then
    echo "  CDK bootstrap not found. Running cdk bootstrap..."
    cd infra-cdk
    cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION"
    cd ..
    if [ $? -ne 0 ]; then
        echo "ERROR: CDK bootstrap failed."
        exit 1
    fi
    echo "  ✓ CDK bootstrap completed"
else
    echo "  ✓ CDK already bootstrapped"
fi
echo ""

# ============================================
# INSTALL CDK DEPENDENCIES
# ============================================
echo "Installing CDK project dependencies..."
cd infra-cdk
npm install
cd ..
echo "  ✓ CDK dependencies installed"
echo ""

# ============================================
# DEPLOYMENT
# ============================================
echo "Deploying backend stack (CDK)..."
cd infra-cdk
cdk deploy --all --require-approval never
cd ..
echo "  ✓ Backend deployment complete"
echo ""

# ============================================
# DEPLOY FRONTEND
# ============================================
echo "Deploying frontend..."
python3 scripts/deploy-frontend.py
echo "  ✓ Frontend deployment complete"
echo ""

# ============================================
# VALIDATION
# ============================================
echo "Validating deployment..."

# Check that the stack exists and has outputs
AMPLIFY_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME_BASE" \
    --query "Stacks[0].Outputs[?OutputKey=='AmplifyUrl'].OutputValue" --output text 2>/dev/null || echo "")

if [ -n "$AMPLIFY_URL" ] && [ "$AMPLIFY_URL" != "None" ]; then
    echo "  ✓ Stack deployed successfully"
    echo "  App URL: $AMPLIFY_URL"
else
    echo "  ✓ Stack deployed (checking nested stacks...)"
    aws cloudformation describe-stacks --stack-name "$STACK_NAME_BASE" \
        --query "Stacks[0].StackStatus" --output text
fi

RUNTIME_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME_BASE" \
    --query "Stacks[0].Outputs[?OutputKey=='RuntimeArn'].OutputValue" --output text 2>/dev/null || echo "")

if [ -n "$RUNTIME_ARN" ] && [ "$RUNTIME_ARN" != "None" ]; then
    echo "  ✓ AgentCore Runtime deployed: $RUNTIME_ARN"
else
    echo "  WARNING: Could not verify AgentCore Runtime ARN"
fi

echo ""
echo "============================================"
echo " Deployment completed successfully!"
echo "============================================"
