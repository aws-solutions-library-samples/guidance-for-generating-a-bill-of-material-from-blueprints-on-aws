"""S3 and DynamoDB helpers for the blueprint analyzer pipeline."""

import time

import boto3


class S3Storage:
    """Handles PDF downloads and result uploads."""

    def __init__(self, bucket_name: str, region: str):
        self.bucket_name = bucket_name
        self.client = boto3.client("s3", region_name=region)

    def download_file(self, key: str, local_path: str) -> None:
        self.client.download_file(self.bucket_name, key, local_path)

    def upload_file(self, local_path: str, key: str) -> None:
        self.client.upload_file(local_path, self.bucket_name, key)

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )

    def generate_upload_url(self, key: str, content_type: str = "application/pdf", expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket_name,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )


class DynamoDBJobs:
    """Tracks job status and metadata."""

    def __init__(self, table_name: str, region: str):
        self.table_name = table_name
        self.table = boto3.resource("dynamodb", region_name=region).Table(table_name)

    def create_job(self, job_id: str, user_id: str, pdf_key: str, output_prefix: str) -> None:
        self.table.put_item(
            Item={
                "userId": user_id,
                "jobId": job_id,
                "pdfKey": pdf_key,
                "outputPrefix": output_prefix,
                "status": "processing",
                "progress": "Starting",
                "createdAt": int(time.time()),
            }
        )

    def update_progress(self, job_id: str, stage: str, message: str) -> None:
        self.table.update_item(
            Key={"jobId": job_id},
            UpdateExpression="SET progress = :p, currentStage = :s, updatedAt = :t",
            ExpressionAttributeValues={
                ":p": message,
                ":s": stage,
                ":t": int(time.time()),
            },
        )

    def complete_job(self, job_id: str, output_prefix: str) -> None:
        self.table.update_item(
            Key={"jobId": job_id},
            UpdateExpression="SET #s = :s, progress = :p, completedAt = :t, outputPrefix = :o",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":s": "complete",
                ":p": "Done",
                ":t": int(time.time()),
                ":o": output_prefix,
            },
        )

    def fail_job(self, job_id: str, error: str) -> None:
        self.table.update_item(
            Key={"jobId": job_id},
            UpdateExpression="SET #s = :s, progress = :p, #e = :e, updatedAt = :t",
            ExpressionAttributeNames={"#s": "status", "#e": "error"},
            ExpressionAttributeValues={
                ":s": "failed",
                ":p": "Failed",
                ":e": error,
                ":t": int(time.time()),
            },
        )

    def get_job(self, job_id: str) -> dict | None:
        resp = self.table.get_item(Key={"jobId": job_id})
        return resp.get("Item")

    def list_user_jobs(self, user_id: str) -> list[dict]:
        resp = self.table.query(
            IndexName="userId-index",
            KeyConditionExpression="userId = :uid",
            ExpressionAttributeValues={":uid": user_id},
            ScanIndexForward=False,
        )
        return resp.get("Items", [])
