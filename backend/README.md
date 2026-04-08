# BoatId Backend - Deployment Steps

## Step 1: Initialize Database

Drops and recreates all tables (`users`, `boat_identifications`, `refresh_tokens`) with the latest schema including `latitude`/`longitude` columns, seeds test data with coastal US coordinates, and creates indexes.

```powershell
cd backend/src
python initialize_database.py
```

> **Warning**: This drops all existing data. To add columns without data loss, run this SQL against RDS instead:
> ```sql
> ALTER TABLE boat_identifications ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
> ALTER TABLE boat_identifications ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
> CREATE INDEX IF NOT EXISTS idx_boat_location ON boat_identifications (latitude, longitude);
> ```

## Step 2: Build & Deploy to AWS Fargate

Rebuilds the Docker image, pushes to ECR, registers a new task definition, and triggers a rolling update on the Fargate service.

```powershell
python backend/deploy_fargate.py
```

## Step 3: Verify Deployment

```powershell
# Health check
curl http://<ALB_URL>/health/detailed

# Test nearby boats endpoint
curl "http://<ALB_URL>/api/v1/boats/nearby?latitude=25.76&longitude=-80.19&radius_km=500"
```