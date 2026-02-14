from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import auth, boats, users

app = FastAPI(
    title="BoatId API",
    description="Boat identification service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(boats.router, prefix="/api/v1/boats", tags=["boats"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])

@app.get("/")
async def root():
    return {"message": "BoatId API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}