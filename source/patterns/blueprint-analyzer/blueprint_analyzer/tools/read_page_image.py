import io
from pathlib import Path

from PIL import Image
from strands.types.tools import ToolResult, ToolUse

MAX_IMAGE_BYTES = 3_800_000  # ~5MB after base64 encoding (33% overhead)

TOOL_SPEC = {
    "name": "read_page_image",
    "description": (
        "Read a blueprint page image file and return it for visual analysis. "
        "Use this tool to view the contents of a page image so you can analyze "
        "the blueprint drawing, schematics, text, and details on that page."
    ),
    "inputSchema": {
        "json": {
            "type": "object",
            "properties": {
                "image_path": {
                    "type": "string",
                    "description": "Absolute path to the PNG image file to analyze.",
                }
            },
            "required": ["image_path"],
        }
    },
}


def _resize_image(image_path: Path) -> bytes:
    """Resize image if it exceeds the max size limit."""
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    if len(image_bytes) <= MAX_IMAGE_BYTES:
        return image_bytes

    img = Image.open(image_path)
    scale = 0.85
    while True:
        new_size = (int(img.width * scale), int(img.height * scale))
        resized = img.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        resized.save(buf, format="PNG", optimize=True)
        image_bytes = buf.getvalue()
        if len(image_bytes) <= MAX_IMAGE_BYTES:
            return image_bytes
        scale *= 0.85


def read_page_image(tool_use: ToolUse, **kwargs) -> ToolResult:
    """Read a page image and return it as image content for vision analysis."""
    tool_use_id = tool_use["toolUseId"]
    image_path = Path(tool_use["input"]["image_path"])

    if not image_path.exists():
        return {
            "toolUseId": tool_use_id,
            "status": "error",
            "content": [{"text": f"Error: Image not found at {image_path}"}],
        }

    image_bytes = _resize_image(image_path)

    return {
        "toolUseId": tool_use_id,
        "status": "success",
        "content": [
            {"text": f"Blueprint page image: {image_path.name}"},
            {
                "image": {
                    "format": "png",
                    "source": {"bytes": image_bytes},
                }
            },
        ],
    }
