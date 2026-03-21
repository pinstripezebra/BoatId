#!/usr/bin/env python3
"""
AppRunner Status Checker
Check the status of your BoatId AppRunner services and retrieve logs
"""

import boto3
import json
import sys
import argparse
from datetime import datetime
from deploy import get_apprunner_logs

def check_service_status(service_arn=None):
    """Check status of AppRunner services"""
    apprunner = boto3.client('apprunner', region_name='us-west-2')
    logs_client = boto3.client('logs', region_name='us-west-2')
    
    try:
        if service_arn:
            # Check specific service
            services_to_check = [service_arn]
        else:
            # List all services and filter for BoatId
            response = apprunner.list_services()
            services_to_check = [
                service['ServiceArn'] for service in response['ServiceSummaryList']
                if 'boatid' in service['ServiceName'].lower()
            ]
            
        if not services_to_check:
            print("❌ No BoatId AppRunner services found")
            return
            
        for service_arn in services_to_check:
            print(f"\n{'='*60}")
            describe_service_status(apprunner, logs_client, service_arn)
            
    except Exception as e:
        print(f"❌ Error checking service status: {e}")
        
def describe_service_status(apprunner, logs_client, service_arn):
    """Get detailed status for a specific service"""
    try:
        service = apprunner.describe_service(ServiceArn=service_arn)['Service']
        
        print(f"🚀 Service: {service['ServiceName']}")
        print(f"📍 Status: {service['Status']}")
        print(f"🌐 URL: https://{service['ServiceUrl']}")
        print(f"📅 Created: {service['CreatedAt']}")
        print(f"🔄 Updated: {service['UpdatedAt']}")
        
        # Check health
        if service['Status'] == 'RUNNING':
            print("✅ Service is running normally")
            print(f"🔗 Health Check: https://{service['ServiceUrl']}/health")
        elif 'FAILED' in service['Status']:
            print("❌ Service has failed")
            
            # Get operations history
            try:
                operations = apprunner.list_operations(ServiceArn=service_arn)
                if operations['OperationSummaryList']:
                    latest_op = operations['OperationSummaryList'][0]
                    print(f"🕰️ Last Operation: {latest_op['Type']} - {latest_op['Status']}")
                    if latest_op.get('StartedAt'):
                        print(f"⏰ Started: {latest_op['StartedAt']}")
                    if latest_op.get('EndedAt'):
                        print(f"⏰ Ended: {latest_op['EndedAt']}")
                        
                    # Get recent logs if failed
                    print(f"\n📋 Recent CloudWatch logs:")
                    logs = get_apprunner_logs(logs_client, service['ServiceName'], lines=10)
                    print(logs)
            except Exception as e:
                print(f"⚠️ Could not get operation details: {e}")
        else:
            print(f"🔄 Service is in transitional state: {service['Status']}")
            
        # Show configuration
        print(f"\n🔧 Configuration:")
        print(f"   CPU: {service['InstanceConfiguration']['Cpu']}")
        print(f"   Memory: {service['InstanceConfiguration']['Memory']}")
        
        if 'HealthCheckConfiguration' in service:
            health_config = service['HealthCheckConfiguration']
            print(f"   Health Check: {health_config['Protocol']} {health_config['Path']}")
            
    except Exception as e:
        print(f"❌ Error describing service: {e}")

def get_service_logs(service_name, lines=50):
    """Get recent logs for a service"""
    logs_client = boto3.client('logs', region_name='us-west-2')
    
    print(f"📋 Recent logs for {service_name}:")
    print("="*60)
    logs = get_apprunner_logs(logs_client, service_name, lines=lines)
    print(logs)

def main():
    parser = argparse.ArgumentParser(
        description="Check AppRunner service status and logs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python check_status.py                                    # Check all BoatId services
  python check_status.py --service-arn arn:aws:apprunner:... # Check specific service
  python check_status.py --logs boatid-backend-012f4805     # Get logs for specific service
  python check_status.py --logs boatid-backend-012f4805 --lines 100  # Get more logs
        """
    )
    
    parser.add_argument('--service-arn', 
                       help='Specific service ARN to check')
    parser.add_argument('--logs', 
                       help='Get logs for service (provide service name)')
    parser.add_argument('--lines', 
                       type=int, 
                       default=50,
                       help='Number of log lines to retrieve (default: 50)')
    
    args = parser.parse_args()
    
    if args.logs:
        get_service_logs(args.logs, args.lines)
    else:
        check_service_status(args.service_arn)

if __name__ == "__main__":
    main()