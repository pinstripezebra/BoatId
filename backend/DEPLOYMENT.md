# BoatId Backend - AWS Deployment

This directory contains the FastAPI backend for the BoatId boat identification application, configured for deployment on AWS Fargate with an Application Load Balancer.

## Architecture

- **Backend**: FastAPI with Python 3.11
- **Database**: AWS RDS PostgreSQL (existing: farmzilla.c16uug8oqgmf.us-west-2.rds.amazonaws.com)
- **Storage**: AWS S3 (existing: lsee-farmzilla-images)
- **AI**: Anthropic Claude for boat identification
- **Deployment**: AWS ECS Fargate with ALB (via `deploy_fargate.py`)
- **Auth**: JWT access tokens (30 min) + database-backed refresh tokens (30 days)

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. Docker running locally
3. Python boto3 library: `pip install boto3`
4. Existing RDS and S3 resources (already configured)

## Quick Deployment

### 1. Configure Secrets

```bash
# Copy the template and fill in your values
cp .env.example .env

# Edit .env with your actual credentials
# DO NOT COMMIT this file - it's excluded via .gitignore
```

Also configure IAM permissions:

```bash
cp iam-policy.json.template iam-policy.json
# Edit with your AWS account details
```

### 2. Initialize Database

Before deploying, ensure the database schema is up to date (includes `users`, `boat_identifications`, and `refresh_tokens` tables):

```bash
cd backend/src
python initialize_database.py
```

> **Warning**: This script drops and recreates all tables. For production, apply schema changes manually instead of re-running this script.

To add only the `refresh_tokens` table without resetting data, run this SQL against your RDS instance:

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens (token_hash);
```

### 3. Deploy to AWS Fargate

```bash
python backend/deploy_fargate.py
```

This script will:
- Create/reuse an ECR repository and push the Docker image
- Create IAM execution and task roles
- Register an ECS task definition with environment variables from `.env`
- Set up VPC networking, security groups, and an Application Load Balancer
- Create or update the ECS Fargate service with a rolling deployment
- Wait for the service to stabilize and print the ALB URL

### Redeploying After Code Changes

To redeploy (e.g. after adding refresh token support):

```bash
python backend/deploy_fargate.py
```

The script is idempotent — it rebuilds the Docker image, pushes to ECR, registers a new task definition, and triggers a rolling update on the existing service. No resources are recreated unnecessarily.

Test endpoints:
- `GET /` - Basic health check
- `GET /health` - Service health
- `GET /health/detailed` - Detailed health with DB/S3 status
- `POST /api/v1/boats/identify` - Boat identification

## Auth Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login (JSON body), returns `access_token` + `refresh_token`
- `POST /auth/token` - Login (OAuth2 form data), returns `access_token` + `refresh_token`
- `POST /auth/refresh` - Exchange a refresh token for new access + rotated refresh tokens
- `POST /auth/logout` - Revoke a refresh token server-side

### Persistent Login Flow

1. On login, the backend issues a 30-minute access token and a 30-day refresh token
2. The refresh token hash (SHA-256) is stored in the `refresh_tokens` database table
3. The mobile app stores the refresh token in Android Keystore (via `react-native-keychain`)
4. On app reopen, the frontend sends the refresh token to `POST /auth/refresh`
5. The backend validates the token, revokes it, and issues a new access token + rotated refresh token
6. On logout, the frontend calls `POST /auth/logout` to revoke the refresh token server-side

## Security Notes

- `.env` contains API keys and credentials — excluded from git
- `iam-policy.json` contains AWS account details — excluded from git
- **Deployment approach**: Secrets are loaded from `.env` and injected into the ECS task definition via API
- Use `.env.example` as a starting point
- Never commit actual credentials, account IDs, or resource names
- Consider using AWS Secrets Manager for production deployments

## Configuration Files

- `.env.example` — Environment variable template (safe to commit)
- `.env` — Actual secrets (gitignored)
- `iam-policy.json` — IAM permissions (gitignored)
- `deploy_fargate.py` — Automated Fargate deployment script
- `Dockerfile` — Container configuration
- `requirements.txt` — Python dependencies

## Environment Variables

Environment variables are handled securely:

- **Local secrets**: Stored in `.env` (gitignored)
- **Deployment**: `deploy_fargate.py` reads `.env` and injects vars into the ECS task definition
- **Security**: Secrets never touch the git repository

Variables include:
- **Database**: RDS connection details
- **Storage**: S3 bucket configuration  
- **AI**: Anthropic API key
- **Auth**: JWT secrets and admin credentials

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your values

# Run locally
cd src
uvicorn main:app --reload
```

## Monitoring

- **Logs**: CloudWatch log group `/ecs/boatid-backend`
- **Metrics**: ECS service metrics in AWS Console (CPU, memory)
- **Health**: Use `/health/detailed` endpoint via ALB URL

## Scaling

ECS Fargate service is configured with:
- CPU: 0.5 vCPU
- Memory: 1 GB
- Desired count: 1 task
- ALB distributes traffic across tasks
- Scale by updating `desiredCount` in `deploy_fargate.py` or via AWS Console

## Cost Estimation

- **Fargate**: ~$15-25/month (0.5 vCPU, 1 GB, 1 task)
- **ALB**: ~$16-20/month
- **RDS**: ~$15-20/month (existing)
- **S3**: ~$1-5/month (existing)
- **ECR**: ~$1/month
- **Total**: ~$48-71/month


## Updating Your Service

To deploy updates:

```bash
# Redeploy to Fargate (rebuilds image, pushes to ECR, rolling update)
python backend/deploy_fargate.py
```

The script detects the existing service and performs a rolling update — no downtime.

## Troubleshooting

### Common Issues

1. **Docker Build Errors**
   - Ensure Docker is running: `docker info`
   - Check `backend/Dockerfile` and `backend/requirements.txt`

2. **Deployment Script Errors**
   - Ensure AWS CLI is configured: `aws configure`
   - Verify `.env` file exists in the `backend/` directory
   - Check IAM permissions in `iam-policy.json`

3. **Database Connection Errors**
   - Verify RDS security groups allow Fargate task traffic
   - Check connection string vars in `.env`

4. **S3 Access Denied**
   - Ensure IAM permissions in `iam-policy.json` match your bucket
   - Verify `AWS_BUCKET_NAME` in `.env`

### Debug Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster boatid-backend-cluster --services boatid-backend --region us-west-2

# View CloudWatch logs
aws logs tail /ecs/boatid-backend --region us-west-2

# Check running tasks
aws ecs list-tasks --cluster boatid-backend-cluster --service-name boatid-backend --region us-west-2

# Force a new deployment without code changes
aws ecs update-service --cluster boatid-backend-cluster --service boatid-backend --force-new-deployment --region us-west-2
```