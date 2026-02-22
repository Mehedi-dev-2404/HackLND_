from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from intelligence.socratic_engine import socratic_viva
from intelligence.career_matcher import analyze_career_match

app = FastAPI(
    title="Beacon - AI Student OS",
    description="UK-focused AI educational platform",
    version="1.0.0"
)


class SocraticRequest(BaseModel):
    topic: str = Field(..., min_length=1, description="Topic for Socratic questioning")
    previous_answer: str | None = Field(None, description="Student's previous answer")


class CareerAnalysisRequest(BaseModel):
    job_text: str = Field(..., min_length=10, description="Job description text")


class SocraticResponse(BaseModel):
    question: str


class CareerAnalysisResponse(BaseModel):
    technical_skills: list[str]
    tools_technologies: list[str]
    cognitive_skills: list[str]
    behavioural_traits: list[str]
    experience_level: str


@app.get("/")
async def root():
    return {
        "service": "Beacon AI Student OS",
        "status": "operational",
        "endpoints": ["/socratic", "/career-analysis"]
    }


@app.post("/socratic", response_model=SocraticResponse)
async def socratic_endpoint(request: SocraticRequest):
    """
    Generate Socratic questions for UK academic context.
    Uses Russell Group teaching methodology.
    """
    try:
        question = socratic_viva(
            topic=request.topic,
            previous_answer=request.previous_answer
        )
        return SocraticResponse(question=question)
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Socratic engine error: {str(e)}"
        )


@app.post("/career-analysis", response_model=CareerAnalysisResponse)
async def career_analysis_endpoint(request: CareerAnalysisRequest):
    """
    Analyze UK job descriptions and extract structured requirements.
    Returns JSON-formatted career match data.
    """
    try:
        analysis = analyze_career_match(job_text=request.job_text)
        return CareerAnalysisResponse(**analysis)
    
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid job description format: {str(e)}"
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Career analysis error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
