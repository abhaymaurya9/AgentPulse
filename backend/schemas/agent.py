from pydantic import BaseModel, Field

class AgentCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    endpoint_url: str = Field(min_length=1)
    model_name: str = Field(min_length=1)