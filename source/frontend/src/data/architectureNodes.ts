export interface ArchitectureNodeMeta {
  label: string
  description: string
  services?: string[]
  flowSteps?: string[]
}

export const ARCHITECTURE_NODES: Record<string, ArchitectureNodeMeta> = {
  // ── Individual nodes ──────────────────────────────────────────────
  user: {
    label: "User",
    description:
      "An architect, estimator, or project manager who uploads construction blueprint PDFs for AI-powered analysis. They authenticate via OIDC and can view structured results or chat with the AI about findings.",
    flowSteps: [
      "1. Upload a blueprint PDF",
      "2. Monitor analysis progress in real-time",
      "3. View structured results (pages, summary, materials, audit)",
      "4. Chat interactively about the blueprint",
    ],
  },
  pdf_upload: {
    label: "PDF Upload",
    description:
      "The upload component uses S3 presigned URLs to bypass API Gateway size limits. The PDF is uploaded directly to S3, then the analysis pipeline is triggered via AgentCore Runtime with an SSE stream for progress updates.",
    services: ["React Dropzone", "S3 Presigned URLs", "SSE Streaming"],
    flowSteps: [
      "1. User drops or selects a PDF file",
      "2. Frontend requests a presigned URL from API Gateway",
      "3. PDF is uploaded directly to S3",
      "4. Frontend invokes AgentCore Runtime to start the pipeline",
    ],
  },
  results_viewer: {
    label: "Results Viewer",
    description:
      "A tabbed interface displaying the four output categories from the analysis pipeline. Each tab renders structured JSON data with typed React components. Includes an image lightbox for viewing blueprint page scans.",
    services: ["React", "TypeScript", "Tailwind CSS"],
    flowSteps: [
      "Fetches results from S3 via API Gateway",
      "Pages tab: browse individual page analyses with images",
      "Project Summary tab: overview, drawing index, materials by CSI division",
      "Material Estimate tab: consolidated door/window/wall schedules",
      "Audit Report tab: cross-reference findings with severity levels",
    ],
  },
  chat_interface: {
    label: "Chat Interface",
    description:
      "A multi-turn conversational UI where users can ask follow-up questions about any aspect of their blueprint analysis. Messages stream in via SSE, and the chat agent has full context of all analysis results.",
    services: ["React", "SSE Streaming", "Markdown Rendering"],
    flowSteps: [
      "7. User types a question about the blueprint",
      "8. Message is sent to AgentCore Runtime via SSE",
      "9. Chat Agent processes with full analysis context",
      "10. Streamed response renders in real-time",
    ],
  },
  runtime: {
    label: "AgentCore Runtime",
    description:
      "The managed runtime that hosts and executes the Strands-based analysis agents. Validates user authentication via OIDC tokens, orchestrates the 6-stage pipeline, and streams progress events back to the frontend.",
    services: ["Amazon Bedrock AgentCore Runtime", "Strands Agent SDK"],
    flowSteps: [
      "3. Receives analysis request with auth token",
      "4. Invokes the pipeline orchestrator",
      "Streams progress events (stage transitions, completions, errors) via SSE",
    ],
  },
  api_gateway: {
    label: "API Gateway",
    description:
      "REST API providing endpoints for job management (list, get, delete), presigned URL generation for uploads, and per-page result retrieval. Authenticated with OIDC tokens.",
    services: ["Amazon API Gateway", "AWS Lambda", "OIDC Authorizer"],
    flowSteps: [
      "Generates S3 presigned URLs for PDF uploads",
      "CRUD operations on job metadata in DynamoDB",
      "Fetches analysis results from S3",
    ],
  },

  // ── Pipeline agents ───────────────────────────────────────────────
  pdf_splitter: {
    label: "Stage 1: PDF Splitter",
    description:
      "The first agent in the pipeline. Uses pdf2image (Poppler) to render each PDF page as a 150 DPI PNG image. Reports the total page count so downstream stages know how many pages to process.",
    services: ["Claude Sonnet", "Strands Agent SDK", "pdf2image / Poppler"],
    flowSteps: [
      "4. Receives PDF path from Runtime",
      "Splits PDF into individual page PNGs at 150 DPI",
      "Saves images to S3 under the job's pages/ prefix",
      "Reports page count for parallel processing",
    ],
  },
  page_analyzer: {
    label: "Stage 2: Page Analyzers",
    description:
      "The most compute-intensive stage. Spawns up to 4 parallel Claude Opus agents, each with vision capabilities. Each agent examines one page image and extracts a comprehensive structured analysis covering 12 categories: page identification, title block, structural elements, doors, windows, walls, materials, construction details, dimensions, reference standards, notes, and additional properties.",
    services: ["Claude Opus (Vision)", "Strands Agent SDK", "4 Parallel Workers"],
    flowSteps: [
      "Receives PNG page images from Stage 1",
      "Each worker calls read_page_image to view the blueprint page",
      "Extracts structured data across 12 categories",
      "Calls save_page_analysis to persist JSON + markdown output",
      "All workers run in parallel via ThreadPoolExecutor",
    ],
  },
  material_extractor: {
    label: "Stage 3: Material Extractors",
    description:
      "Runs 4 parallel Sonnet agents that read the structured page analyses from Stage 2 and extract per-page material takeoffs. Focuses on doors, windows, walls, and raw materials with exact quantities and specifications.",
    services: ["Claude Sonnet", "Strands Agent SDK", "4 Parallel Workers"],
    flowSteps: [
      "Reads structured JSON from Stage 2 page analyses",
      "Extracts per-page material data: doors, windows, walls, materials",
      "Records assumptions and unclear items",
      "Saves per-page material JSON via save_page_materials",
    ],
  },
  material_summarizer: {
    label: "Stage 4: Material Summarizer",
    description:
      "A single Sonnet agent that reads all per-page material files and consolidates them into a unified project estimate. Deduplicates items appearing on multiple pages, sums quantities, and flags conflicts where the same mark has different specs on different sheets.",
    services: ["Claude Sonnet", "Strands Agent SDK"],
    flowSteps: [
      "Reads all per-page material JSONs from Stage 3",
      "Deduplicates door/window marks across pages",
      "Sums quantities and cross-references source sheets",
      "Flags conflicts (same mark, different specs)",
      "Produces consolidated door schedule, window schedule, wall summary, material totals",
    ],
  },
  project_summarizer: {
    label: "Stage 5: Project Summarizer",
    description:
      "A single Sonnet agent that synthesizes all page analyses into a high-level project overview. Organizes materials by CSI division, creates a drawing index, identifies key specifications and standards, and provides quantity estimates where data supports them.",
    services: ["Claude Sonnet", "Strands Agent SDK"],
    flowSteps: [
      "Reads all page analysis JSONs from Stage 2",
      "Synthesizes project overview from title blocks",
      "Creates drawing index (sheet number, type, title)",
      "Groups materials by CSI division (06-Wood, 07-Thermal, 08-Openings, etc.)",
      "Lists key specifications, codes, and standards",
    ],
  },
  auditor: {
    label: "Stage 6: Auditor",
    description:
      "A quality-control agent that cross-references individual page analyses against the project summary to identify inconsistencies, omissions, and discrepancies. Assigns severity levels (critical, major, minor) and provides specific correction recommendations.",
    services: ["Claude Sonnet", "Strands Agent SDK"],
    flowSteps: [
      "Reads all page analyses and the project summary",
      "Cross-references materials, schedules, and specs",
      "Flags discrepancies by category and severity",
      "Checks: door/window schedule gaps, material conflicts, quantity errors",
      "Produces completeness percentage and recommended corrections",
      "If critical or major findings exist, triggers Stage 7",
    ],
  },
  remediator: {
    label: "Stage 7: Remediator",
    description:
      "A conditional stage that only runs when the audit finds critical or major issues. Regenerates the project summary from scratch using the page analyses as the authoritative source, guided by the audit findings. The corrected summary overwrites the original so the user always sees the best version.",
    services: ["Claude Sonnet", "Strands Agent SDK"],
    flowSteps: [
      "Only triggered if audit found critical or major findings",
      "Reads the audit report, original project summary, and all page analyses",
      "Regenerates a complete corrected summary (not a patch)",
      "Ensures every flagged omission is now included",
      "Overwrites the project summary in S3 with the corrected version",
      "Skipped entirely if audit passes clean",
    ],
  },
  chat_agent: {
    label: "Chat Agent",
    description:
      "A conversational Sonnet agent pre-loaded with all analysis context from a specific job. Can read page images from S3 to answer visual questions. Supports multi-turn conversations about the blueprint's materials, specifications, dimensions, and findings.",
    services: ["Claude Sonnet", "Strands Agent SDK", "S3 Image Access"],
    flowSteps: [
      "9. Invoked by Runtime with full job context",
      "Pre-loaded with project summary, material estimate, and audit report",
      "Can view original page images via read_page_image_s3 tool",
      "Answers questions about materials, specs, discrepancies, etc.",
    ],
  },

  // ── Storage ───────────────────────────────────────────────────────
  s3_pdfs: {
    label: "S3 Bucket (PDFs + Images)",
    description:
      "Stores uploaded PDF files and the page images generated by the PDF Splitter. Uses presigned URLs for direct browser uploads to bypass API Gateway's 10MB payload limit.",
    services: ["Amazon S3", "Presigned URLs"],
    flowSteps: [
      "2. Receives PDF via presigned PUT from browser",
      "Stores page PNG images from PDF Splitter",
      "Serves page images to Chat Agent for visual Q&A",
    ],
  },
  s3_results: {
    label: "S3 Results",
    description:
      "Stores all structured analysis outputs as JSON files organized by job ID: per-page analyses, per-page materials, consolidated material estimate, project summary, and audit report.",
    services: ["Amazon S3"],
    flowSteps: [
      "5. Receives JSON outputs from pipeline stages",
      "6. Serves results to the frontend Results Viewer",
      "Provides context to Chat Agent for answering questions",
    ],
  },
  dynamodb: {
    label: "DynamoDB",
    description:
      "Stores job metadata including job ID, status (processing/complete/failed), upload timestamp, filename, page count, and S3 key prefixes. Used by the frontend to list previous analyses and check job status.",
    services: ["Amazon DynamoDB"],
    flowSteps: [
      "Stores job metadata on creation",
      "Updated with status as pipeline progresses",
      "Queried by API Gateway for job list/detail",
    ],
  },

  // ── Clusters (subgraph IDs) ───────────────────────────────────────
  cluster_frontend: {
    label: "Frontend (React)",
    description:
      "The web application tier built with React, TypeScript, and Tailwind CSS. Provides PDF upload, real-time progress monitoring, structured results viewing, and interactive chat. Hosted on AWS Amplify with OIDC authentication.",
    services: ["React 19", "TypeScript", "Vite", "Tailwind CSS", "AWS Amplify"],
  },
  cluster_agentcore: {
    label: "Amazon Bedrock AgentCore",
    description:
      "The managed agent platform that hosts the analysis pipeline and chat agent. Provides Runtime for agent execution, SSE streaming for real-time progress, and API Gateway for REST operations.",
    services: ["AgentCore Runtime", "API Gateway", "OIDC Authentication"],
  },
  cluster_pipeline: {
    label: "Analysis Pipeline (7 Stages)",
    description:
      "The core multi-agent pipeline that processes blueprints. Runs 7 stages with parallel execution within stages 2 and 3. Each stage is a specialized Strands agent with specific tools and a focused prompt. Uses Claude Opus for vision-intensive page analysis and Claude Sonnet for all other stages. Stage 7 (Remediation) is conditional — it only runs if the audit finds critical or major issues.",
    services: ["Claude Opus", "Claude Sonnet", "Strands Agent SDK", "ThreadPoolExecutor"],
    flowSteps: [
      "Stage 1: PDF Splitter (Sonnet) - Split PDF to page images",
      "Stage 2: Page Analyzers (Opus, 4x parallel) - Vision-based extraction",
      "Stage 3: Material Extractors (Sonnet, 4x parallel) - Per-page takeoffs",
      "Stage 4: Material Summarizer (Sonnet) - Consolidate & deduplicate",
      "Stage 5: Project Summarizer (Sonnet) - CSI-organized overview",
      "Stage 6: Auditor (Sonnet) - Cross-reference & validate",
      "Stage 7: Remediator (Sonnet, conditional) - Correct summary if audit fails",
    ],
  },
  cluster_chat: {
    label: "Chat Agent",
    description:
      "An interactive conversational agent that can answer questions about completed analyses. Has access to all structured results and can view original page images from S3 for visual reference.",
    services: ["Claude Sonnet", "Strands Agent SDK", "S3 Read Access"],
  },
  cluster_storage: {
    label: "Storage",
    description:
      "The persistence layer comprising S3 for file storage (PDFs, images, JSON results) and DynamoDB for job metadata. S3 presigned URLs enable direct browser-to-S3 uploads for large files.",
    services: ["Amazon S3", "Amazon DynamoDB", "Presigned URLs"],
  },
}
