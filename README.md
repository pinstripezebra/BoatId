# 🚤 BoatID

BoatID is a mobile application that identifies boats from photos using AI. Take a picture of any boat with your phone, and the app will analyze the image to determine its make, model, type, and other details.

## Overview

- **Frontend**: React Native mobile app (Android/iOS) with camera integration
- **Backend**: FastAPI service deployed on AWS Fargate behind an Application Load Balancer
- **AI**: Anthropic Claude Vision (claude-3-haiku) for boat image analysis
- **Storage**: AWS S3 for images, PostgreSQL (RDS) for identification results and user data

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Client["📱 Mobile Client"]
        RN["React Native App<br/>(Android / iOS)"]
        CAM["Camera Module<br/>react-native-image-picker"]
        API_SVC["API Service Layer<br/>httpClient / boatApi"]
    end

    subgraph AWS["☁️ AWS Cloud (us-west-2)"]
        ALB["Application Load Balancer<br/>HTTP :80"]

        subgraph ECS["ECS Fargate Cluster"]
            FAST["FastAPI Backend<br/>uvicorn :8080"]
        end

        subgraph Routes["API Routes"]
            AUTH["/auth<br/>Register, Login, JWT Tokens"]
            BOATS["/api/v1/boats<br/>Identify, Upload, Search"]
            USERS["/api/v1/users<br/>Profiles, Admin"]
        end

        subgraph Services["Backend Services"]
            ID_SVC["Boat Identification<br/>Service"]
            S3_SVC["S3 Storage<br/>Service"]
            DB_SVC["Storage Service<br/>(CRUD)"]
        end

        ANTHROPIC["Anthropic Claude<br/>Vision API<br/>(claude-3-haiku)"]
        S3["AWS S3<br/>Image Storage"]
        RDS["AWS RDS<br/>PostgreSQL"]
    end

    RN --> CAM
    CAM --> API_SVC
    API_SVC -->|"HTTP Requests"| ALB
    ALB -->|"Forward :8080"| FAST
    FAST --> AUTH
    FAST --> BOATS
    FAST --> USERS
    BOATS --> ID_SVC
    BOATS --> DB_SVC
    ID_SVC --> ANTHROPIC
    ID_SVC --> S3_SVC
    S3_SVC --> S3
    DB_SVC --> RDS
    AUTH --> RDS
    USERS --> RDS

    style Client fill:#E3F2FD,stroke:#1565C0
    style AWS fill:#FFF3E0,stroke:#E65100
    style ECS fill:#E8F5E9,stroke:#2E7D32
    style Routes fill:#F3E5F5,stroke:#7B1FA2
    style Services fill:#FFF9C4,stroke:#F9A825
```

## 📁 Project Structure

| Directory | Description |
|-----------|-------------|
| `frontend/` | React Native mobile app (TypeScript) |
| `backend/` | FastAPI backend service (Python) |
| `infrastructure/` | Terraform IaC definitions |
| `data/` | Sample CSV data and images |
| `scripts/` | Utility scripts |

## 🚀 Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
python deploy_fargate.py   # Deploy to AWS Fargate with ALB
```

### Frontend

```bash
cd frontend
npm install

# Build Android APK (run as separate commands in PowerShell)
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android; .\gradlew assembleDebug
```
