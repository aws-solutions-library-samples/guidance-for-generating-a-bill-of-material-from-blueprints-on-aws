#!/bin/bash
set -e

# ============================================
# Guidance for Generating a Bill of Materials from Blueprints on AWS
# User-Facing Deploy Script
# ============================================
# This script deploys the full Blueprint Analyzer stack to your AWS account.
# It handles: CDK backend deployment + React frontend deployment.
#
# Prerequisites: AWS CLI, Node.js 20+, Python 3.11+, Docker, CDK CLI
# Usage: ./scripts/deploy.sh
# ============================================

# ============================================
# CONFIGURATION
# ============================================
AWS_REGION="${AWS_REGION:-}"
STACK_NAME_BASE="BlueprintAnalyzer"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"

# ============================================
# PLATFORM DETECTION
# ============================================
detect_platform() {
    case "$(uname -s)" in
        Darwin*)  PLATFORM="macos" ;;
        Linux*)   PLATFORM="linux" ;;
        MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
        *)        PLATFORM="unknown" ;;
    esac
    echo "Detected platform: $PLATFORM"
}

# ============================================
# PREREQUISITE CHECKS
# ============================================
check_prerequisites() {
    echo ""
    echo "Checking prerequisites..."
    echo "---"

    command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI is required. Install: https://aws.amazon.com/cli/"; exit 1; }
    echo "  ✓ AWS CLI found"

    command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js is required. Install: https://nodejs.org/"; exit 1; }
    NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        echo "ERROR: Node.js 20+ required (found v$NODE_VERSION)"
        exit 1
    fi
    echo "  ✓ Node.js $(node --version)"

    command -v python3 >/dev/null 2>&1 || { echo "ERROR: Python 3 is required."; exit 1; }
    echo "  ✓ Python $(python3 --version | awk '{print $2}')"

    command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker is required. Install: https://docs.docker.com/get-docker/"; exit 1; }
    docker info >/dev/null 2>&1 || { echo "ERROR: Docker daemon is not running. Start Docker/Colima first."; exit 1; }
    echo "  ✓ Docker running"

    command -v cdk >/dev/null 2>&1 || { echo "ERROR: AWS CDK CLI is required. Install: npm install -g aws-cdk"; exit 1; }
    echo "  ✓ CDK $(cdk --version | awk '{print $1}')"

    # Verify AWS credentials
    aws sts get-caller-identity >/dev/null 2>&1 || { echo "ERROR: AWS credentials not configured. Run 'aws configure' or set environment variables."; exit 1; }
    echo "  ✓ AWS credentials valid"

    echo "---"
    echo "All prerequisites met."
}

# ============================================
# REGION SELECTION
# ============================================
select_region() {
    if [ -z "$AWS_REGION" ]; then
        # Try to get from AWS config
        AWS_REGION=$(aws configure get region 2>/dev/null || echo "")
    fi

    if [ -z "$AWS_REGION" ]; then
        echo ""
        echo "Select AWS region for deployment:"
        echo "  1) us-east-1 (N. Virginia) - recommended"
        echo "  2) us-west-2 (Oregon)"
        echo "  3) eu-west-1 (Ireland)"
        echo "  4) Enter custom region"
        echo ""
        read -p "Choice [1]: " REGION_CHOICE
        case "${REGION_CHOICE:-1}" in
            1) AWS_REGION="us-east-1" ;;
            2) AWS_REGION="us-west-2" ;;
            3) AWS_REGION="eu-west-1" ;;
            4) read -p "Enter region: " AWS_REGION ;;
            *) AWS_REGION="us-east-1" ;;
        esac
    fi

    export AWS_REGION
    export AWS_DEFAULT_REGION="$AWS_REGION"
    echo "Using region: $AWS_REGION"
}

# ============================================
# MAIN DEPLOYMENT
# ============================================
main() {
    echo "============================================"
    echo " Blueprint Analyzer - Deployment"
    echo " Guidance for Generating a Bill of Materials"
    echo " from Blueprints on AWS"
    echo "============================================"

    # Determine project root (script is in scripts/)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

    detect_platform
    check_prerequisites
    select_region

    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo ""
    echo "Deployment details:"
    echo "  Account:    $ACCOUNT_ID"
    echo "  Region:     $AWS_REGION"
    echo "  Stack name: $STACK_NAME_BASE"
    echo ""

    # ============================================
    # CDK BOOTSTRAP CHECK
    # ============================================
    echo "Checking CDK bootstrap status..."
    CDK_BOOTSTRAP_STACK=$(aws cloudformation describe-stacks --region "$AWS_REGION" \
        --query "Stacks[?StackName=='CDKToolkit'].StackName" --output text 2>/dev/null || echo "")

    if [ -z "$CDK_BOOTSTRAP_STACK" ] || [ "$CDK_BOOTSTRAP_STACK" == "None" ]; then
        echo "CDK bootstrap not found. Running cdk bootstrap..."
        cd "$PROJECT_ROOT/infra-cdk"
        cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION"
        echo "  ✓ CDK bootstrap complete"
    else
        echo "  ✓ CDK already bootstrapped"
    fi

    # ============================================
    # INSTALL CDK DEPENDENCIES
    # ============================================
    echo ""
    echo "Installing CDK dependencies..."
    cd "$PROJECT_ROOT/infra-cdk"
    npm install
    echo "  ✓ CDK dependencies installed"

    # ============================================
    # DEPLOY BACKEND (CDK)
    # ============================================
    echo ""
    echo "Deploying backend stack (this may take 5-10 minutes)..."
    cd "$PROJECT_ROOT/infra-cdk"
    cdk deploy --all --require-approval never
    echo "  ✓ Backend deployment complete"

    # ============================================
    # DEPLOY FRONTEND
    # ============================================
    echo ""
    echo "Deploying frontend..."
    cd "$PROJECT_ROOT"
    python3 scripts/deploy-frontend.py
    echo "  ✓ Frontend deployment complete"

    # ============================================
    # VALIDATION
    # ============================================
    echo ""
    echo "Validating deployment..."
    AMPLIFY_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME_BASE" \
        --query "Stacks[0].Outputs[?OutputKey=='AmplifyUrl'].OutputValue" --output text 2>/dev/null || echo "")

    if [ -n "$AMPLIFY_URL" ] && [ "$AMPLIFY_URL" != "None" ]; then
        echo "  ✓ Application deployed successfully"
        echo ""
        echo "============================================"
        echo " Deployment Complete!"
        echo "============================================"
        echo ""
        echo " App URL: $AMPLIFY_URL"
        echo ""
        echo " Next steps:"
        echo "   1. Open the URL above in your browser"
        echo "   2. Sign in with the Cognito user credentials"
        echo "      (check your email if you set admin_user_email in config.yaml)"
        echo "   3. Upload a construction blueprint PDF to analyze"
        echo ""
    else
        echo "  ✓ Deployment completed (check Amplify console for URL)"
    fi

    # ============================================
    # CLEANUP INSTRUCTIONS
    # ============================================
    echo " To clean up all resources:"
    echo "   cd $PROJECT_ROOT/infra-cdk"
    echo "   cdk destroy --all --force"
    echo ""
}

main "$@"
