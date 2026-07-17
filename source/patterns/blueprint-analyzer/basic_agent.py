"""Blueprint Analyzer agent pattern for FAST.

Accepts a PDF S3 key, runs the 6-stage analysis pipeline,
streams progress events via SSE, and stores results in S3 + DynamoDB.
"""

import json
import logging
import os
import uuid

import boto3
from bedrock_agentcore.runtime import BedrockAgentCoreApp, RequestContext
from utils.auth import extract_user_id_from_context

from blueprint_analyzer.pipeline import run_pipeline

logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp()

BUCKET_NAME = os.environ.get("BLUEPRINT_BUCKET")
TABLE_NAME = os.environ.get("BLUEPRINT_TABLE")
REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

# Maximum accepted lengths for untrusted request input, to guard against
# excessive token consumption and cost/DoS amplification from oversized payloads.
MAX_PROMPT_CHARS = 100_000
MAX_KEY_CHARS = 1024


@app.entrypoint
async def invocations(payload, context: RequestContext):
    """Main entrypoint - called by AgentCore Runtime on each request.

    Payload fields:
      - mode: "analyze" (default) or "chat"
      - prompt: User message (PDF key for analyze, question for chat)
      - pdf_key: S3 key of the uploaded PDF (analyze mode)
      - job_id: Job ID for chat context (chat mode)
      - runtimeSessionId: Session identifier
    """
    mode = payload.get("mode", "analyze")

    if mode == "chat":
        job_id = payload.get("job_id")
        user_query = payload.get("prompt", "")
        if not job_id or not user_query:
            yield {"status": "error", "error": "Missing job_id or prompt for chat mode"}
            return
        if len(user_query) > MAX_PROMPT_CHARS:
            yield {"status": "error", "error": "Prompt exceeds the maximum allowed length"}
            return
        if not BUCKET_NAME:
            yield {"status": "error", "error": "Server misconfigured: BLUEPRINT_BUCKET required"}
            return

        from blueprint_analyzer.chat_agent import create_chat_agent

        try:
            agent = create_chat_agent(job_id, BUCKET_NAME, REGION)
            async for event in agent.stream_async(user_query):
                yield json.loads(json.dumps(dict(event), default=str))
        except Exception:
            logger.exception("Chat agent failed for job %s", job_id)
            yield {
                "status": "error",
                "error": "An internal error occurred while processing your request.",
            }
        return

    user_id = extract_user_id_from_context(context)
    session_id = payload.get("runtimeSessionId")
    pdf_key = payload.get("pdf_key") or payload.get("prompt", "")

    if not pdf_key:
        yield {"status": "error", "error": "Missing required field: pdf_key"}
        return
    if len(pdf_key) > MAX_KEY_CHARS:
        yield {"status": "error", "error": "pdf_key exceeds the maximum allowed length"}
        return

    if not BUCKET_NAME or not TABLE_NAME:
        yield {
            "status": "error",
            "error": "Server misconfigured: BLUEPRINT_BUCKET and BLUEPRINT_TABLE required",
        }
        return

    job_id = str(uuid.uuid4())

    yield {
        "type": "progress",
        "stage": "init",
        "message": f"Starting analysis job {job_id}",
        "job_id": job_id,
    }

    try:
        async for event in run_pipeline(
            pdf_key=pdf_key,
            bucket_name=BUCKET_NAME,
            table_name=TABLE_NAME,
            job_id=job_id,
            user_id=user_id,
            region=REGION,
        ):
            yield json.loads(json.dumps(event, default=str))

    except Exception:
        logger.exception("Pipeline failed for job %s", job_id)
        yield {
            "type": "error",
            "job_id": job_id,
            "error": "An internal error occurred during analysis.",
        }


if __name__ == "__main__":
    app.run()
