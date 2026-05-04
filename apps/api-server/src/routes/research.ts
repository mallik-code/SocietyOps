import { Router, Request, Response } from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import { google } from "googleapis";
import * as XLSX from "xlsx";
import { Readable } from "stream";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const KNOWLEDGE_SERVICE_URL = process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:8000";
const GOOGLE_DRIVE_API_KEY = process.env.GOOGLE_DRIVE_API_KEY || process.env.EMBEDDING_API_KEY; // Reuse embedding key if it's a Google key


async function extractTextFromBuffer(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const data = await mammoth.extractRawText({ buffer: buffer });
    return data.value;
  } else if (mimetype === "text/plain") {
    return buffer.toString("utf8");
  } else if (mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let text = "";
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      text += `\nSheet: ${sheetName}\n`;
      text += XLSX.utils.sheet_to_txt(worksheet);
    });
    return text;
  }
  throw new Error(`Unsupported file type: ${mimetype} (${originalname})`);
}

/**
 * Chunk text into smaller pieces
 */
function chunkText(text: string, size: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

/**
 * POST /research/upload
 * Uploads a document, extracts text, and ingests into knowledge service.
 */
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { collection_id } = req.body;
    if (!collection_id) {
      return res.status(400).json({ error: "collection_id is required" });
    }

    const content = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
    const chunks = chunkText(content);
    const document_id = uuidv4();
    const source_name = req.file.originalname;

    console.log(`Ingesting document ${source_name} into collection ${collection_id} (${chunks.length} chunks)`);

    // Ingest chunks into knowledge service (in background to avoid timeout)
    const ingestChunks = async () => {
      console.log(`Starting background ingestion for ${source_name}: ${chunks.length} chunks`);
      const ingestPromises = chunks.map((chunk, index) => {
        return fetch(`${KNOWLEDGE_SERVICE_URL}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: chunk,
            collection_id,
            document_id,
            source_name,
            page_number: Math.floor(index / 2) + 1, // Rough estimate
            category: "research"
          })
        }).catch(err => console.error(`Failed to ingest chunk ${index} for ${source_name}:`, err.message));
      });

      await Promise.all(ingestPromises);
      console.log(`Finished background ingestion for ${source_name}`);
    };

    // Fire and forget
    ingestChunks();

    res.json({
      success: true,
      document_id,
      source_name,
      chunk_count: chunks.length,
      status: "processing"
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Failed to process document" });
  }
});

/**
 * POST /research/google-drive
 * Downloads a file from Google Drive and ingests it.
 */
router.post("/google-drive", async (req: Request, res: Response) => {
  try {
    let { fileId, collection_id } = req.body;
    if (!fileId || !collection_id) {
      return res.status(400).json({ error: "fileId and collection_id are required" });
    }

    // Basic URL extraction if they passed a link
    if (fileId.includes("google.com")) {
      const match = fileId.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) fileId = match[1];
    }

    if (!GOOGLE_DRIVE_API_KEY) {
      throw new Error("GOOGLE_DRIVE_API_KEY is not configured on the server.");
    }

    const drive = google.drive({ version: "v3", auth: GOOGLE_DRIVE_API_KEY });
    
    // 1. Get file metadata
    const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
    const { name, mimeType } = meta.data;

    console.log(`Downloading Google Drive file: ${name} (${mimeType})`);

    // 2. Download content
    // Note: Export for Google Docs/Sheets, direct download for binaries
    let buffer: Buffer;
    let finalMimetype = mimeType || "";

    if (mimeType === "application/vnd.google-apps.document") {
      // Export Google Docs to PDF
      const exportResp = await drive.files.export({ 
        fileId, 
        mimeType: "application/pdf" 
      }, { responseType: "arraybuffer" });
      buffer = Buffer.from(exportResp.data as ArrayBuffer);
      finalMimetype = "application/pdf";
    } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
      // Export Google Spreadsheets to CSV
      const exportResp = await drive.files.export({ 
        fileId, 
        mimeType: "text/csv" 
      }, { responseType: "arraybuffer" });
      buffer = Buffer.from(exportResp.data as ArrayBuffer);
      finalMimetype = "text/plain";
    } else if (mimeType?.startsWith("application/vnd.google-apps.")) {
      // Generic export to PDF for other Google types (Slides, etc)
      const exportResp = await drive.files.export({ 
        fileId, 
        mimeType: "application/pdf" 
      }, { responseType: "arraybuffer" });
      buffer = Buffer.from(exportResp.data as ArrayBuffer);
      finalMimetype = "application/pdf";
    } else {
      const downloadResp = await drive.files.get({ 
        fileId, 
        alt: "media" 
      }, { responseType: "arraybuffer" });
      buffer = Buffer.from(downloadResp.data as ArrayBuffer);
    }

    // 3. Process
    const content = await extractTextFromBuffer(buffer, finalMimetype, name || "Unknown");
    const chunks = chunkText(content);
    const document_id = uuidv4();
    const source_name = name || "Google Drive File";

    // 4. Ingest (in background to avoid timeout)
    const ingestChunks = async () => {
      console.log(`Starting background ingestion for ${source_name}: ${chunks.length} chunks`);
      const ingestPromises = chunks.map((chunk, index) => {
        return fetch(`${KNOWLEDGE_SERVICE_URL}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: chunk,
            collection_id,
            document_id,
            source_name,
            page_number: Math.floor(index / 2) + 1,
            category: "research"
          })
        }).catch(err => console.error(`Failed to ingest chunk ${index} for ${source_name}:`, err.message));
      });

      await Promise.all(ingestPromises);
      console.log(`Finished background ingestion for ${source_name}`);
    };

    // Fire and forget (in a real app, use a proper job queue like BullMQ)
    ingestChunks();

    res.json({
      success: true,
      document_id,
      source_name,
      chunk_count: chunks.length,
      status: "processing"
    });

  } catch (error: any) {
    console.error("Error with Google Drive ingestion:", error.message);
    res.status(500).json({ error: error.message || "Failed to process Google Drive file" });
  }
});

/**
 * GET /research/collections/:id/search
 * Search within a specific collection
 */
router.get("/collections/:id/search", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { q, limit = 5 } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const response = await fetch(`${KNOWLEDGE_SERVICE_URL}/search?query=${encodeURIComponent(q as string)}&limit=${limit}&collection_id=${id}`);
    
    if (!response.ok) {
      throw new Error(`Knowledge service returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error searching collection:", error);
    res.status(500).json({ error: "Failed to search collection" });
  }
});

/**
 * GET /research/collections/:id/documents
 * List unique documents in a collection
 */
router.get("/collections/:id/documents", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // We proxy this to knowledge service as well
    // Knowledge service needs a new endpoint or we use a clever query
    const response = await fetch(`${KNOWLEDGE_SERVICE_URL}/documents?collection_id=${id}`);
    
    if (!response.ok) {
      throw new Error(`Knowledge service returned ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error listing documents:", error);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

export default router;
