"""S3-backed page image reader for the blueprint chat agent."""

import io
import tempfile
from pathlib import Path

import boto3
from PIL import Image
from strands.types.tools import ToolResult, ToolUse

MAX_IMAGE_BYTES = 3_800_000


def _resize_image(image_bytes: bytes) -> bytes:
    if len(image_bytes) <= MAX_IMAGE_BYTES:
        return image_bytes

    img = Image.open(io.BytesIO(image_bytes))
    scale = 0.85
    while True:
        new_size = (int(img.width * scale), int(img.height * scale))
        resized = img.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        resized.save(buf, format="PNG", optimize=True)
        result = buf.getvalue()
        if len(result) <= MAX_IMAGE_BYTES:
            return result
        scale *= 0.85


def create_read_page_image_s3(bucket_name: str, output_prefix: str, region: str):
    """Factory that creates a read_page_image tool bound to a specific S3 location."""

    s3_client = boto3.client("s3", region_name=region)

    TOOL_SPEC = {
        "name": "read_page_image",
        "description": (
            "View a specific blueprint page image for visual analysis. "
            "Use this when the user asks about visual details, dimensions, "
            "or anything you need to verify by looking at the original drawing."
        ),
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "page_number": {
                        "type": "integer",
                        "description": "The page number to view (1-indexed).",
                    }
                },
                "required": ["page_number"],
            }
        },
    }

    def read_page_image(tool_use: ToolUse, **kwargs) -> ToolResult:
        tool_use_id = tool_use["toolUseId"]
        page_number = tool_use["input"]["page_number"]

        key = f"{output_prefix}/pages/page_{page_number:03d}.png"

        try:
            resp = s3_client.get_object(Bucket=bucket_name, Key=key)
            image_bytes = resp["Body"].read()
        except s3_client.exceptions.NoSuchKey:
            return {
                "toolUseId": tool_use_id,
                "status": "error",
                "content": [{"text": f"Error: Page {page_number} image not found."}],
            }
        except Exception as e:
            return {
                "toolUseId": tool_use_id,
                "status": "error",
                "content": [{"text": f"Error reading page image: {e}"}],
            }

        image_bytes = _resize_image(image_bytes)

        return {
            "toolUseId": tool_use_id,
            "status": "success",
            "content": [
                {"text": f"Blueprint page {page_number} image:"},
                {
                    "image": {
                        "format": "png",
                        "source": {"bytes": image_bytes},
                    }
                },
            ],
        }

    read_page_image.TOOL_SPEC = TOOL_SPEC
    return read_page_image
