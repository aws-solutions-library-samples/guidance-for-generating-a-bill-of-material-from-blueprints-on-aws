"""Blueprint API Lambda - handles upload URLs, direct uploads, and job queries."""

import json
import logging
import os
import re
import uuid

import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET_NAME = os.environ["BLUEPRINT_BUCKET"]
TABLE_NAME = os.environ["BLUEPRINT_TABLE"]

s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def handler(event, context):
    method = event.get("httpMethod", "")
    path = event.get("path", "")
    headers = _cors_headers(event)

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        if method == "POST" and path == "/blueprint/upload":
            return _upload_file(event, headers)
        elif method == "GET" and path == "/blueprint/jobs":
            return _list_jobs(event, headers)
        elif method == "GET" and path.startswith("/blueprint/jobs/"):
            job_id = path.split("/")[-1]
            return _get_job(event, job_id, headers)
        elif method == "GET" and "/results/" in path and path.endswith("/pages"):
            parts = path.split("/")
            job_id = parts[parts.index("results") + 1]
            return _get_pages(event, job_id, headers)
        elif method == "GET" and path.startswith("/blueprint/results/"):
            job_id = path.split("/")[-1]
            return _get_results(event, job_id, headers)
        elif method == "DELETE" and path.startswith("/blueprint/jobs/"):
            job_id = path.split("/")[-1]
            return _delete_job(event, job_id, headers)
        else:
            return {
                "statusCode": 404,
                "headers": headers,
                "body": json.dumps({"error": "Not found"}),
            }
    except Exception:
        # Log full detail server-side only; return a generic message to the caller
        logger.exception("Unhandled error in blueprint-api handler")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": "Internal server error"}),
        }


def _upload_file(event, headers):
    """Return a presigned PUT URL for direct-to-S3 upload."""
    params = event.get("queryStringParameters") or {}
    filename = params.get("filename", "blueprint.pdf")

    upload_id = str(uuid.uuid4())
    key = f"uploads/{upload_id}/{filename}"

    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": key,
            "ContentType": "application/pdf",
        },
        ExpiresIn=900,
    )

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "uploadUrl": presigned_url,
            "pdfKey": key,
            "uploadId": upload_id,
        }),
    }


def _list_jobs(event, headers):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    user_id = claims.get("sub", "")

    if not user_id:
        return {
            "statusCode": 401,
            "headers": headers,
            "body": json.dumps({"error": "Unauthorized"}),
        }

    resp = table.query(
        IndexName="userId-index",
        KeyConditionExpression=Key("userId").eq(user_id),
        ScanIndexForward=False,
        Limit=50,
    )

    items = resp.get("Items", [])
    for item in items:
        for key in ["createdAt", "completedAt", "updatedAt"]:
            if key in item:
                item[key] = int(item[key])

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({"jobs": items}, default=str),
    }


def _get_authenticated_user_id(event):
    """Return the Cognito 'sub' claim for the requesting user, or '' if absent."""
    claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    return claims.get("sub", "")


def _get_job(event, job_id, headers):
    user_id = _get_authenticated_user_id(event)
    if not user_id:
        return {
            "statusCode": 401,
            "headers": headers,
            "body": json.dumps({"error": "Unauthorized"}),
        }

    resp = table.get_item(Key={"jobId": job_id})
    item = resp.get("Item")

    if not item:
        return {
            "statusCode": 404,
            "headers": headers,
            "body": json.dumps({"error": "Job not found"}),
        }

    if item.get("userId") != user_id:
        return {
            "statusCode": 403,
            "headers": headers,
            "body": json.dumps({"error": "Forbidden"}),
        }

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({"job": item}, default=str),
    }


def _get_results(event, job_id, headers):
    user_id = _get_authenticated_user_id(event)
    if not user_id:
        return {
            "statusCode": 401,
            "headers": headers,
            "body": json.dumps({"error": "Unauthorized"}),
        }

    resp = table.get_item(Key={"jobId": job_id})
    item = resp.get("Item")

    if not item or item.get("status") != "complete":
        return {
            "statusCode": 404,
            "headers": headers,
            "body": json.dumps({"error": "Results not available"}),
        }

    if item.get("userId") != user_id:
        return {
            "statusCode": 403,
            "headers": headers,
            "body": json.dumps({"error": "Forbidden"}),
        }

    output_prefix = item.get("outputPrefix", "")

    result_files = {
        "project_summary": "project_summary.json",
        "project_summary_raw": "project_summary.md",
        "material_estimate": "material_estimate.json",
        "material_estimate_raw": "material_estimate.md",
        "audit_report": "audit_report.json",
        "audit_report_raw": "audit_report.md",
    }

    results = {}
    for result_key, filename in result_files.items():
        key = f"{output_prefix}/{filename}"
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": key},
            ExpiresIn=3600,
        )
        results[result_key] = url

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({"results": results}),
    }


def _get_pages(event, job_id, headers):
    """Return per-page analysis, material, and image URLs for a completed job."""
    user_id = _get_authenticated_user_id(event)
    if not user_id:
        return {
            "statusCode": 401,
            "headers": headers,
            "body": json.dumps({"error": "Unauthorized"}),
        }

    resp = table.get_item(Key={"jobId": job_id})
    item = resp.get("Item")

    if not item or item.get("status") != "complete":
        return {
            "statusCode": 404,
            "headers": headers,
            "body": json.dumps({"error": "Results not available"}),
        }

    if item.get("userId") != user_id:
        return {
            "statusCode": 403,
            "headers": headers,
            "body": json.dumps({"error": "Forbidden"}),
        }

    output_prefix = item.get("outputPrefix", "")

    analysis_prefix = f"{output_prefix}/analysis/"
    pages_prefix = f"{output_prefix}/pages/"
    materials_prefix = f"{output_prefix}/materials/"

    analysis_resp = s3_client.list_objects_v2(
        Bucket=BUCKET_NAME, Prefix=analysis_prefix
    )
    analysis_files = sorted(
        [obj["Key"] for obj in analysis_resp.get("Contents", [])
         if obj["Key"].endswith("_analysis.json")]
    )

    pages = []
    for af in analysis_files:
        filename = af.split("/")[-1]
        page_name = filename.replace("_analysis.json", "")

        match = re.search(r"page_(\d+)", page_name)
        page_number = int(match.group(1)) if match else 0

        analysis_json_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": af},
            ExpiresIn=3600,
        )

        analysis_raw_key = f"{analysis_prefix}{page_name}_analysis.md"
        analysis_raw_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": analysis_raw_key},
            ExpiresIn=3600,
        )

        image_key = f"{pages_prefix}{page_name}.png"
        image_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": image_key},
            ExpiresIn=3600,
        )

        materials_json_key = f"{materials_prefix}{page_name}_materials.json"
        materials_json_url = None
        materials_raw_url = None
        try:
            s3_client.head_object(Bucket=BUCKET_NAME, Key=materials_json_key)
            materials_json_url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": BUCKET_NAME, "Key": materials_json_key},
                ExpiresIn=3600,
            )
            materials_raw_key = f"{materials_prefix}{page_name}_materials.md"
            materials_raw_url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": BUCKET_NAME, "Key": materials_raw_key},
                ExpiresIn=3600,
            )
        except s3_client.exceptions.ClientError:
            pass

        page_info = {
            "pageNumber": page_number,
            "name": page_name,
            "analysisUrl": analysis_json_url,
            "analysisRawUrl": analysis_raw_url,
            "imageUrl": image_url,
        }
        if materials_json_url:
            page_info["materialsUrl"] = materials_json_url
        if materials_raw_url:
            page_info["materialsRawUrl"] = materials_raw_url

        pages.append(page_info)

    pages.sort(key=lambda p: p["pageNumber"])

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({"pages": pages}),
    }


def _delete_job(event, job_id, headers):
    """Delete a job and all associated S3 objects."""
    claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    user_id = claims.get("sub", "")

    if not user_id:
        return {
            "statusCode": 401,
            "headers": headers,
            "body": json.dumps({"error": "Unauthorized"}),
        }

    resp = table.get_item(Key={"jobId": job_id})
    item = resp.get("Item")

    if not item:
        return {
            "statusCode": 404,
            "headers": headers,
            "body": json.dumps({"error": "Job not found"}),
        }

    if item.get("userId") != user_id:
        return {
            "statusCode": 403,
            "headers": headers,
            "body": json.dumps({"error": "Forbidden"}),
        }

    output_prefix = item.get("outputPrefix", "")
    if output_prefix:
        _delete_s3_prefix(output_prefix)

    pdf_key = item.get("pdfKey", "")
    if pdf_key:
        try:
            s3_client.delete_object(Bucket=BUCKET_NAME, Key=pdf_key)
        except s3_client.exceptions.ClientError:
            pass

    table.delete_item(Key={"jobId": job_id})

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({"message": "Job deleted"}),
    }


def _delete_s3_prefix(prefix):
    """Delete all objects under a given S3 prefix."""
    paginator = s3_client.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=BUCKET_NAME, Prefix=prefix)

    for page in pages:
        contents = page.get("Contents", [])
        if not contents:
            continue

        objects = [{"Key": obj["Key"]} for obj in contents]
        s3_client.delete_objects(
            Bucket=BUCKET_NAME,
            Delete={"Objects": objects},
        )


def _cors_headers(event):
    origin = (
        event.get("headers", {}).get("origin", "")
        or event.get("headers", {}).get("Origin", "")
    )

    return {
        "Access-Control-Allow-Origin": origin or "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        "Content-Type": "application/json",
    }
