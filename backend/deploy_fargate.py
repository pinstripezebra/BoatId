"""
Deploy BoatId backend to AWS Fargate using ECR + ECS.

Usage:
    python backend/deploy_fargate.py

Requires:
    - Docker running locally
    - AWS credentials configured (aws configure)
    - backend/apprunner.yaml with env vars (reused for config)
    - backend/iam-policy.json for task role permissions
"""

import boto3
import json
import time
import sys
import os
import logging
import subprocess
from botocore.exceptions import ClientError
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

load_dotenv()

# Constants
REGION = "us-west-2"
SERVICE_NAME = "boatid-backend"
CONTAINER_PORT = 8080
CPU = "512"       # 0.5 vCPU
MEMORY = "1024"   # 1 GB


def get_account_id():
    sts = boto3.client("sts", region_name=REGION)
    return sts.get_caller_identity()["Account"]


def load_env_vars():
    """Load environment variables from backend/apprunner.yaml"""
    import yaml
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "apprunner.yaml")

    if not os.path.exists(config_path):
        logger.error(f"Config not found: {config_path}")
        sys.exit(1)

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    env_vars = {}
    if "run" in config and "env" in config["run"]:
        for item in config["run"]["env"]:
            env_vars[item["name"]] = item["value"]
    env_vars["PORT"] = str(CONTAINER_PORT)
    env_vars["AWS_DEFAULT_REGION"] = REGION
    return env_vars


def run_cmd(cmd, check=True):
    """Run a shell command and return output."""
    logger.info(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        logger.error(f"Command failed: {result.stderr}")
        sys.exit(1)
    return result


def ensure_ecr_repo(ecr, repo_name):
    """Create ECR repository if it doesn't exist."""
    try:
        ecr.describe_repositories(repositoryNames=[repo_name])
        logger.info(f"ECR repo '{repo_name}' exists")
    except ecr.exceptions.RepositoryNotFoundException:
        ecr.create_repository(
            repositoryName=repo_name,
            imageScanningConfiguration={"scanOnPush": True},
        )
        logger.info(f"Created ECR repo '{repo_name}'")


def build_and_push_image(account_id, repo_name):
    """Build Docker image and push to ECR."""
    ecr_uri = f"{account_id}.dkr.ecr.{REGION}.amazonaws.com"
    image_tag = f"{ecr_uri}/{repo_name}:latest"

    # Docker login to ECR
    logger.info("Logging in to ECR...")
    login_cmd = f"aws ecr get-login-password --region {REGION} | docker login --username AWS --password-stdin {ecr_uri}"
    run_cmd(login_cmd)

    # Build from backend directory using its Dockerfile
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    logger.info(f"Building Docker image from {backend_dir}...")
    run_cmd(f'docker build -t {image_tag} "{backend_dir}"')

    # Push
    logger.info("Pushing image to ECR...")
    run_cmd(f"docker push {image_tag}")

    return image_tag


def ensure_ecs_cluster(ecs, cluster_name):
    """Create ECS cluster if it doesn't exist."""
    resp = ecs.describe_clusters(clusters=[cluster_name])
    active = [c for c in resp["clusters"] if c["status"] == "ACTIVE"]
    if active:
        logger.info(f"ECS cluster '{cluster_name}' exists")
        return active[0]["clusterArn"]

    resp = ecs.create_cluster(clusterName=cluster_name)
    logger.info(f"Created ECS cluster '{cluster_name}'")
    return resp["cluster"]["clusterArn"]


def ensure_iam_roles(iam, account_id):
    """Create ECS task execution role and task role."""
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Task execution role (lets ECS pull images from ECR and write logs)
    exec_role_name = f"{SERVICE_NAME}-exec-role"
    exec_role_arn = f"arn:aws:iam::{account_id}:role/{exec_role_name}"
    exec_trust = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "ecs-tasks.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }
    try:
        iam.create_role(
            RoleName=exec_role_name,
            AssumeRolePolicyDocument=json.dumps(exec_trust),
        )
        iam.attach_role_policy(
            RoleName=exec_role_name,
            PolicyArn="arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
        )
        logger.info(f"Created execution role: {exec_role_name}")
    except ClientError as e:
        if "EntityAlreadyExists" in str(e):
            logger.info(f"Execution role '{exec_role_name}' exists")
        else:
            raise

    # Task role (lets the app access S3, RDS, etc.)
    task_role_name = f"{SERVICE_NAME}-task-role"
    task_role_arn = f"arn:aws:iam::{account_id}:role/{task_role_name}"
    task_trust = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "ecs-tasks.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }
    try:
        iam.create_role(
            RoleName=task_role_name,
            AssumeRolePolicyDocument=json.dumps(task_trust),
        )
        policy_path = os.path.join(script_dir, "iam-policy.json")
        with open(policy_path) as f:
            policy_doc = json.load(f)
        iam.put_role_policy(
            RoleName=task_role_name,
            PolicyName="BoatIdTaskPolicy",
            PolicyDocument=json.dumps(policy_doc),
        )
        logger.info(f"Created task role: {task_role_name}")
    except ClientError as e:
        if "EntityAlreadyExists" in str(e):
            logger.info(f"Task role '{task_role_name}' exists")
        else:
            raise

    return exec_role_arn, task_role_arn


def ensure_log_group(logs_client, log_group):
    """Create CloudWatch log group if it doesn't exist."""
    try:
        logs_client.create_log_group(logGroupName=log_group)
        logger.info(f"Created log group: {log_group}")
    except ClientError as e:
        if "ResourceAlreadyExistsException" in str(e):
            logger.info(f"Log group '{log_group}' exists")
        else:
            raise


def register_task_definition(ecs, image_tag, exec_role_arn, task_role_arn, env_vars, log_group):
    """Register ECS task definition."""
    container_env = [{"name": k, "value": v} for k, v in env_vars.items()]

    resp = ecs.register_task_definition(
        family=SERVICE_NAME,
        networkMode="awsvpc",
        requiresCompatibilities=["FARGATE"],
        cpu=CPU,
        memory=MEMORY,
        executionRoleArn=exec_role_arn,
        taskRoleArn=task_role_arn,
        containerDefinitions=[{
            "name": SERVICE_NAME,
            "image": image_tag,
            "portMappings": [{"containerPort": CONTAINER_PORT, "protocol": "tcp"}],
            "environment": container_env,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": log_group,
                    "awslogs-region": REGION,
                    "awslogs-stream-prefix": "ecs",
                },
            },
            "essential": True,
        }],
    )
    task_def_arn = resp["taskDefinition"]["taskDefinitionArn"]
    logger.info(f"Registered task definition: {task_def_arn}")
    return task_def_arn


def get_default_vpc_and_subnets(ec2):
    """Get default VPC and its subnets."""
    vpcs = ec2.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])
    if not vpcs["Vpcs"]:
        logger.error("No default VPC found. Create one or specify VPC/subnet IDs.")
        sys.exit(1)
    vpc_id = vpcs["Vpcs"][0]["VpcId"]

    subnets = ec2.describe_subnets(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}])
    subnet_ids = [s["SubnetId"] for s in subnets["Subnets"]]
    logger.info(f"Using VPC {vpc_id} with subnets: {subnet_ids}")
    return vpc_id, subnet_ids


def ensure_security_group(ec2, vpc_id):
    """Create or find a security group that allows inbound on 8080."""
    sg_name = f"{SERVICE_NAME}-sg"
    try:
        resp = ec2.describe_security_groups(
            Filters=[
                {"Name": "group-name", "Values": [sg_name]},
                {"Name": "vpc-id", "Values": [vpc_id]},
            ]
        )
        if resp["SecurityGroups"]:
            sg_id = resp["SecurityGroups"][0]["GroupId"]
            logger.info(f"Using existing security group: {sg_id}")
            return sg_id
    except ClientError:
        pass

    resp = ec2.create_security_group(
        GroupName=sg_name,
        Description="BoatId Fargate service",
        VpcId=vpc_id,
    )
    sg_id = resp["GroupId"]

    ec2.authorize_security_group_ingress(
        GroupId=sg_id,
        IpPermissions=[{
            "IpProtocol": "tcp",
            "FromPort": CONTAINER_PORT,
            "ToPort": CONTAINER_PORT,
            "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "HTTP access"}],
        }],
    )
    logger.info(f"Created security group: {sg_id}")
    return sg_id


def ensure_alb_security_group(ec2, vpc_id):
    """Create or find a security group for the ALB that allows inbound on port 80."""
    sg_name = f"{SERVICE_NAME}-alb-sg"
    try:
        resp = ec2.describe_security_groups(
            Filters=[
                {"Name": "group-name", "Values": [sg_name]},
                {"Name": "vpc-id", "Values": [vpc_id]},
            ]
        )
        if resp["SecurityGroups"]:
            sg_id = resp["SecurityGroups"][0]["GroupId"]
            logger.info(f"Using existing ALB security group: {sg_id}")
            return sg_id
    except ClientError:
        pass

    resp = ec2.create_security_group(
        GroupName=sg_name,
        Description="BoatId ALB - allows HTTP traffic",
        VpcId=vpc_id,
    )
    sg_id = resp["GroupId"]

    ec2.authorize_security_group_ingress(
        GroupId=sg_id,
        IpPermissions=[{
            "IpProtocol": "tcp",
            "FromPort": 80,
            "ToPort": 80,
            "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "HTTP access"}],
        }],
    )
    logger.info(f"Created ALB security group: {sg_id}")
    return sg_id


def ensure_fargate_sg_allows_alb(ec2, fargate_sg_id, alb_sg_id):
    """Ensure the Fargate SG allows inbound from the ALB SG on the container port."""
    try:
        ec2.authorize_security_group_ingress(
            GroupId=fargate_sg_id,
            IpPermissions=[{
                "IpProtocol": "tcp",
                "FromPort": CONTAINER_PORT,
                "ToPort": CONTAINER_PORT,
                "UserIdGroupPairs": [{"GroupId": alb_sg_id, "Description": "ALB to Fargate"}],
            }],
        )
        logger.info(f"Added ALB SG {alb_sg_id} to Fargate SG {fargate_sg_id} inbound rules")
    except ClientError as e:
        if "Duplicate" in str(e) or "InvalidPermission.Duplicate" in str(e):
            logger.info("Fargate SG already allows ALB traffic")
        else:
            raise


def ensure_alb(elbv2, vpc_id, subnet_ids, alb_sg_id):
    """Create or find the Application Load Balancer."""
    alb_name = f"{SERVICE_NAME}-alb"

    # Check if ALB already exists
    try:
        resp = elbv2.describe_load_balancers(Names=[alb_name])
        if resp["LoadBalancers"]:
            alb = resp["LoadBalancers"][0]
            logger.info(f"Using existing ALB: {alb['DNSName']}")
            return alb["LoadBalancerArn"], alb["DNSName"]
    except ClientError as e:
        if "LoadBalancerNotFound" not in str(e):
            raise

    resp = elbv2.create_load_balancer(
        Name=alb_name,
        Subnets=subnet_ids,
        SecurityGroups=[alb_sg_id],
        Scheme="internet-facing",
        Type="application",
        IpAddressType="ipv4",
    )
    alb = resp["LoadBalancers"][0]
    alb_arn = alb["LoadBalancerArn"]
    alb_dns = alb["DNSName"]
    logger.info(f"Created ALB: {alb_dns}")

    # Wait for ALB to become active
    logger.info("Waiting for ALB to become active...")
    waiter = elbv2.get_waiter("load_balancer_available")
    waiter.wait(LoadBalancerArns=[alb_arn])
    logger.info("ALB is active")

    return alb_arn, alb_dns


def ensure_target_group(elbv2, vpc_id):
    """Create or find the target group for Fargate tasks."""
    tg_name = f"{SERVICE_NAME}-tg"

    # Check if target group already exists
    try:
        resp = elbv2.describe_target_groups(Names=[tg_name])
        if resp["TargetGroups"]:
            tg_arn = resp["TargetGroups"][0]["TargetGroupArn"]
            logger.info(f"Using existing target group: {tg_name}")
            return tg_arn
    except ClientError as e:
        if "TargetGroupNotFound" not in str(e):
            raise

    resp = elbv2.create_target_group(
        Name=tg_name,
        Protocol="HTTP",
        Port=CONTAINER_PORT,
        VpcId=vpc_id,
        TargetType="ip",
        HealthCheckProtocol="HTTP",
        HealthCheckPath="/health",
        HealthCheckIntervalSeconds=30,
        HealthCheckTimeoutSeconds=10,
        HealthyThresholdCount=2,
        UnhealthyThresholdCount=3,
        Matcher={"HttpCode": "200"},
    )
    tg_arn = resp["TargetGroups"][0]["TargetGroupArn"]
    logger.info(f"Created target group: {tg_name}")
    return tg_arn


def ensure_alb_listener(elbv2, alb_arn, tg_arn):
    """Create HTTP listener on port 80 if it doesn't exist."""
    resp = elbv2.describe_listeners(LoadBalancerArn=alb_arn)
    for listener in resp.get("Listeners", []):
        if listener["Port"] == 80:
            logger.info("ALB listener on port 80 already exists")
            return listener["ListenerArn"]

    resp = elbv2.create_listener(
        LoadBalancerArn=alb_arn,
        Protocol="HTTP",
        Port=80,
        DefaultActions=[{
            "Type": "forward",
            "TargetGroupArn": tg_arn,
        }],
    )
    listener_arn = resp["Listeners"][0]["ListenerArn"]
    logger.info("Created ALB listener on port 80")
    return listener_arn


def create_or_update_service(ecs, cluster_name, task_def_arn, subnet_ids, sg_id, tg_arn=None):
    """Create or update ECS Fargate service."""
    try:
        resp = ecs.describe_services(cluster=cluster_name, services=[SERVICE_NAME])
        active = [s for s in resp["services"] if s["status"] == "ACTIVE"]

        if active:
            logger.info(f"Updating existing service '{SERVICE_NAME}'...")
            ecs.update_service(
                cluster=cluster_name,
                service=SERVICE_NAME,
                taskDefinition=task_def_arn,
                forceNewDeployment=True,
            )
            return
    except ClientError:
        pass

    service_kwargs = dict(
        cluster=cluster_name,
        serviceName=SERVICE_NAME,
        taskDefinition=task_def_arn,
        desiredCount=1,
        launchType="FARGATE",
        networkConfiguration={
            "awsvpcConfiguration": {
                "subnets": subnet_ids,
                "securityGroups": [sg_id],
                "assignPublicIp": "ENABLED",
            }
        },
        healthCheckGracePeriodSeconds=60,
    )

    if tg_arn:
        service_kwargs["loadBalancers"] = [{
            "targetGroupArn": tg_arn,
            "containerName": SERVICE_NAME,
            "containerPort": CONTAINER_PORT,
        }]

    logger.info(f"Creating new service '{SERVICE_NAME}'...")
    ecs.create_service(**service_kwargs)


def wait_for_service(ecs, cluster_name, alb_dns=None):
    """Wait for service to stabilize."""
    logger.info("Waiting for service to stabilize...")
    start = time.time()
    while True:
        resp = ecs.describe_services(cluster=cluster_name, services=[SERVICE_NAME])
        service = resp["services"][0]
        running = service.get("runningCount", 0)
        desired = service.get("desiredCount", 1)
        elapsed = int(time.time() - start)

        logger.info(f"Running: {running}/{desired} (elapsed: {elapsed}s)")

        if running >= desired and desired > 0:
            if alb_dns:
                print(f"\n🎉 Deployed successfully!")
                print(f"🌐 ALB URL:  http://{alb_dns}")
                print(f"🔗 Health:   http://{alb_dns}/health")
                return

            # Fallback: get task public IP
            tasks = ecs.list_tasks(cluster=cluster_name, serviceName=SERVICE_NAME)
            if tasks["taskArns"]:
                task_details = ecs.describe_tasks(cluster=cluster_name, tasks=tasks["taskArns"])
                for task in task_details["tasks"]:
                    for attachment in task.get("attachments", []):
                        for detail in attachment.get("details", []):
                            if detail["name"] == "networkInterfaceId":
                                ec2 = boto3.client("ec2", region_name=REGION)
                                eni = ec2.describe_network_interfaces(
                                    NetworkInterfaceIds=[detail["value"]]
                                )
                                public_ip = eni["NetworkInterfaces"][0].get("Association", {}).get("PublicIp")
                                if public_ip:
                                    print(f"\n🎉 Deployed successfully!")
                                    print(f"🌐 API URL: http://{public_ip}:{CONTAINER_PORT}")
                                    print(f"🔗 Health:  http://{public_ip}:{CONTAINER_PORT}/health")
                                    return
            print(f"\n🎉 Service is running! Check AWS Console for task IP.")
            return

        if elapsed > 600:
            logger.error("Timeout waiting for service to stabilize")
            # Print recent events for debugging
            for event in service.get("events", [])[:5]:
                logger.error(f"  {event['message']}")
            sys.exit(1)

        time.sleep(15)


def deploy():
    """Main deployment flow."""
    account_id = get_account_id()
    logger.info(f"AWS Account: {account_id}")

    env_vars = load_env_vars()
    sensitive_keys = ["PASSWORD", "SECRET", "KEY", "TOKEN"]
    safe_count = sum(1 for k in env_vars if any(s in k.upper() for s in sensitive_keys))
    logger.info(f"Loaded {len(env_vars)} env vars ({safe_count} sensitive)")

    # Initialize clients
    ecr = boto3.client("ecr", region_name=REGION)
    ecs = boto3.client("ecs", region_name=REGION)
    iam = boto3.client("iam", region_name=REGION)
    ec2 = boto3.client("ec2", region_name=REGION)
    logs_client = boto3.client("logs", region_name=REGION)

    repo_name = SERVICE_NAME
    cluster_name = f"{SERVICE_NAME}-cluster"
    log_group = f"/ecs/{SERVICE_NAME}"

    # Step 1: ECR repo
    print("📦 Ensuring ECR repository...")
    ensure_ecr_repo(ecr, repo_name)

    # Step 2: Build & push Docker image
    print("🐳 Building and pushing Docker image...")
    image_tag = build_and_push_image(account_id, repo_name)

    # Step 3: IAM roles
    print("🔐 Ensuring IAM roles...")
    exec_role_arn, task_role_arn = ensure_iam_roles(iam, account_id)
    # Brief pause for IAM propagation
    time.sleep(10)

    # Step 4: Log group
    print("📋 Ensuring CloudWatch log group...")
    ensure_log_group(logs_client, log_group)

    # Step 5: Task definition
    print("📝 Registering task definition...")
    task_def_arn = register_task_definition(ecs, image_tag, exec_role_arn, task_role_arn, env_vars, log_group)

    # Step 6: Networking
    print("🌐 Setting up networking...")
    vpc_id, subnet_ids = get_default_vpc_and_subnets(ec2)
    sg_id = ensure_security_group(ec2, vpc_id)

    # Step 6b: ALB
    print("⚖️  Setting up Application Load Balancer...")
    elbv2 = boto3.client("elbv2", region_name=REGION)
    alb_sg_id = ensure_alb_security_group(ec2, vpc_id)
    ensure_fargate_sg_allows_alb(ec2, sg_id, alb_sg_id)
    alb_arn, alb_dns = ensure_alb(elbv2, vpc_id, subnet_ids, alb_sg_id)
    tg_arn = ensure_target_group(elbv2, vpc_id)
    ensure_alb_listener(elbv2, alb_arn, tg_arn)

    # Step 7: ECS cluster
    print("🏗️  Ensuring ECS cluster...")
    ensure_ecs_cluster(ecs, cluster_name)

    # Step 8: Create/update service
    print("🚀 Deploying service...")
    create_or_update_service(ecs, cluster_name, task_def_arn, subnet_ids, sg_id, tg_arn)

    # Step 9: Wait
    wait_for_service(ecs, cluster_name, alb_dns)


if __name__ == "__main__":
    deploy()
