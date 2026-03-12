# BoatId Backend - AWS App Runner Deployment

This directory contains the FastAPI backend for the BoatId boat identification application, configured for deployment on AWS App Runner.

## Architecture

- **Backend**: FastAPI with Python 3.11
- **Database**: AWS RDS PostgreSQL (existing: farmzilla.c16uug8oqgmf.us-west-2.rds.amazonaws.com)
- **Storage**: AWS S3 (existing: lsee-farmzilla-images)
- **AI**: Anthropic Claude for boat identification
- **Deployment**: AWS App Runner

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. GitHub account for code repository  
3. Python boto3 library: `pip install boto3`
4. **GitHub connection in AWS App Runner** (see troubleshooting if needed)
5. Existing RDS and S3 resources (already configured)

## Quick Deployment

### 1. Configure Secrets

```bash
# Copy templates and fill in your values
cp apprunner.yaml.template apprunner.yaml
cp iam-policy.json.template iam-policy.json

# Edit both files with your actual credentials/account details
# DO NOT COMMIT THESE FILES - they're excluded via .gitignore
```

### 2. Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial BoatId backend commit"
git remote add origin https://github.com/yourusername/boatid-backend.git
git branch -M main
git push -u origin main
```

**Note**: Only `apprunner-public.yaml` (safe config) is tracked. Secrets stay local in `apprunner.yaml`

### 3. Deploy with Python Script

```bash
python deploy.py https://github.com/yourusername/boatid-backend
```

That's it! The script will:
- Create IAM roles and permissions
- Deploy your FastAPI service to App Runner
- Configure health checks and auto-scaling
- Wait for deployment and provide your API URL

Your service will be available at:
```
https://[random-id].us-west-2.awsapprunner.com
```

Test endpoints:
- `GET /` - Basic health check
- `GET /health` - Service health
- `GET /health/detailed` - Detailed health with DB/S3 status
- `POST /api/v1/boats/identify` - Boat identification

## Security Notes

- `apprunner.yaml` contains API keys and credentials - excluded from git
- `apprunner-public.yaml` contains build config only - safe to commit
- `iam-policy.json` contains AWS account details - excluded from git
- **Deployment approach**: Secrets are injected via API, not stored in repository
- Use template files (`.template`) as starting points
- Never commit actual credentials, account IDs, or resource names
- `.env` files are also excluded from git via `.gitignore`
- Consider using AWS Secrets Manager for production deployments

## Configuration Files

- `apprunner.yaml.template` - App Runner service configuration template (with secrets)
- `apprunner-public.yaml` - Public build configuration (safe to commit)
- `iam-policy.json.template` - IAM permissions template
- `deploy.py` - Automated deployment script using boto3
- `requirements.txt` - Python dependencies
- `Dockerfile` - Container configuration

## Environment Variables

Environment variables are handled securely:

- **Local secrets**: Stored in `apprunner.yaml` (gitignored)
- **Deployment**: Script reads local config and injects via AWS API
- **Repository**: Only contains `apprunner-public.yaml` with build instructions
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

- **Logs**: Available in App Runner console
- **Metrics**: CPU, memory, request metrics
- **Health**: Use `/health/detailed` endpoint

## Scaling

App Runner automatically scales with cost optimization:
- Min instances: 1 (lowest possible)
- Max instances: 2 (cost-controlled)
- Resources: 0.25 vCPU, 0.5GB RAM (minimum tier)
- Auto-pause: Scales down during low traffic

## Cost Estimation (Optimized)

- **App Runner**: ~$7-15/month (minimal resources)
- **RDS**: ~$15-20/month (existing)
- **S3**: ~$1-5/month (existing)
- **Total**: ~$23-40/month


## Updating Your Service

To deploy updates:

```bash
# Commit and push changes
git add .
git commit -m "Update boat identification"
git push

# App Runner will automatically redeploy from GitHub
# Or redeploy manually with:
python deploy.py https://github.com/yourusername/boatid-backend
```

## Troubleshooting

### Common Issues

1. **GitHub Connection Error** (`Authentication configuration is invalid`)
   - Create GitHub connection first: AWS Console > App Runner > GitHub connections
   - Click "Create connection" and authorize GitHub access
   - PowerShell CLI: `aws apprunner create-connection --connection-name github-connection --provider-type GITHUB --region us-west-2`
   - If you get "Connection name already exists" - that's good! Proceed with deployment
   - Then authorize the connection in your GitHub account

2. **Deployment Script Errors**
   - Ensure AWS CLI is configured: `aws configure`
   - Check GitHub URL is accessible and contains apprunner.yaml
   - Verify environment variables in .env file

2. **Database Connection Errors**
   - Verify RDS security groups allow App Runner traffic
   - Check connection string in apprunner.yaml

3. **S3 Access Denied**
   - Ensure IAM permissions in iam-policy.json match your bucket
   - Verify bucket name in apprunner.yaml

### Debug Commands

```bash
# Check service status
aws apprunner describe-service --service-arn [service-arn]

# View logs
aws logs tail /aws/apprunner/boatid-backend/application
```

## Security Notes

- Environment variables contain sensitive data
- `.env` files are excluded from git via `.gitignore`
- Use AWS Secrets Manager for production secrets (optional upgrade)