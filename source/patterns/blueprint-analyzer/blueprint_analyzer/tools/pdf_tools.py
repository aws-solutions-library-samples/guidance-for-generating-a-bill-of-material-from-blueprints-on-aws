from pathlib import Path

import fitz
from strands import tool


@tool
def split_pdf_to_images(pdf_path: str, output_dir: str, dpi: int = 150) -> str:
    """Split a PDF into individual page images.

    Args:
        pdf_path: Path to the input PDF file.
        output_dir: Directory to save page images.
        dpi: Resolution for rendering pages (default 150).

    Returns:
        JSON-formatted list of output image paths and page count.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return f"Error: PDF not found at {pdf_path}"

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    page_count = len(doc)
    image_paths = []

    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)

    for page_num in range(page_count):
        page = doc[page_num]
        pix = page.get_pixmap(matrix=matrix, alpha=False)

        output_path = output_dir / f"page_{page_num + 1:03d}.png"
        pix.save(str(output_path))
        image_paths.append(str(output_path))

    doc.close()

    return (
        f"Successfully split '{pdf_path.name}' into {page_count} pages.\n"
        f"Images saved to: {output_dir}\n"
        f"Pages: {', '.join(image_paths)}"
    )


@tool
def list_page_images(directory: str) -> str:
    """List all page image files in a directory, sorted by page number.

    Args:
        directory: Path to the directory containing page images.

    Returns:
        Sorted list of image file paths.
    """
    directory = Path(directory)
    if not directory.exists():
        return f"Error: Directory not found at {directory}"

    images = sorted(directory.glob("page_*.png"))
    if not images:
        return f"No page images found in {directory}"

    return "\n".join(str(p) for p in images)


@tool
def save_analysis(content: str, output_path: str) -> str:
    """Save analysis content to a markdown file.

    Args:
        content: The markdown content to save.
        output_path: Path where the file should be saved.

    Returns:
        Confirmation message.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return f"Analysis saved to: {output_path}"


@tool
def read_analysis(file_path: str) -> str:
    """Read a previously saved analysis file.

    Args:
        file_path: Path to the analysis markdown file.

    Returns:
        Contents of the file.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        return f"Error: File not found at {file_path}"
    return file_path.read_text(encoding="utf-8")


@tool
def list_analysis_files(directory: str) -> str:
    """List all analysis files in a directory (JSON and markdown).

    Args:
        directory: Path to the directory containing analysis files.

    Returns:
        Sorted list of analysis file paths.
    """
    directory = Path(directory)
    if not directory.exists():
        return f"Error: Directory not found at {directory}"

    files = sorted(
        list(directory.glob("*.json")) + list(directory.glob("*.md"))
    )
    if not files:
        return f"No analysis files found in {directory}"

    return "\n".join(str(p) for p in files)
