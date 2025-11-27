from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return {"message": "Welcome to the API"}


@app.get("/health")
def health_check():
    """Health check endpoint for monitoring and load balancers"""
    return {"status": "healthy", "service": "choremate-api"}
