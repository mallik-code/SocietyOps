import * as fs from "fs";
import * as path from "path";

// In the Docker runtime image, WORKDIR is /workspace/artifacts/api-server
// and CSV files are copied to dist/data/. Locally (ts-node / tsx), __dirname
// resolves to src/lib so we need to go up two levels to reach src/data.
// We check which path exists at startup and use whichever is present.
const DIST_DATA = path.join(process.cwd(), "dist", "data");
const SRC_DATA  = path.join(__dirname, "..", "data");
const DATA_DIR  = fs.existsSync(DIST_DATA) ? DIST_DATA : SRC_DATA;

/**
 * Minimal RFC-4180 CSV parser.
 * Handles double-quoted fields (which may contain commas and escaped "" quotes).
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let value = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          value += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          value += line[i++];
        }
      }
      fields.push(value);
      if (line[i] === ",") i++; // skip comma after field
    } else {
      // Unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

function parseCsv(filename: string): Record<string, string>[] {
  const filePath = path.join(DATA_DIR, filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] ?? "";
    });
    return row;
  });
}

/** Convert hours-ago offset to ISO timestamp string */
function hoursAgo(h: string | undefined): string {
  if (!h || h.trim() === "") return new Date().toISOString();
  return new Date(Date.now() - parseFloat(h) * 3_600_000).toISOString();
}

/** Convert days-ago offset to ISO timestamp string */
function daysAgo(d: string | undefined): string {
  if (!d || d.trim() === "") return new Date().toISOString();
  return new Date(Date.now() - parseFloat(d) * 86_400_000).toISOString();
}

/** null if empty string, else the value */
function nullable(v: string | undefined): string | null {
  return v === undefined || v.trim() === "" ? null : v.trim();
}

// ─── Typed loaders ────────────────────────────────────────────────────────────

export function loadTickets() {
  return parseCsv("tickets.csv").map((r) => ({
    id: parseInt(r.id, 10),
    message_text: r.message_text,
    category: r.category,
    priority: r.priority,
    status: r.status,
    location: nullable(r.location),
    reporter_name: nullable(r.reporter_name),
    group_name: nullable(r.group_name),
    created_at: hoursAgo(r.created_hours_ago),
    updated_at: r.updated_hours_ago?.trim() ? hoursAgo(r.updated_hours_ago) : null,
  }));
}

export function loadRawMessages() {
  return parseCsv("raw_messages.csv").map((r) => ({
    id: parseInt(r.id, 10),
    text: r.text,
    sender: r.sender,
    group_name: nullable(r.group_name),
    category: nullable(r.category),
    timestamp: hoursAgo(r.created_hours_ago),
  }));
}

export function loadTrackedGroups() {
  return parseCsv("tracked_groups.csv").map((r) => ({
    id: parseInt(r.id, 10),
    name: r.name,
    group_id: r.group_id,
    description: nullable(r.description),
    enabled: r.enabled === "true",
    message_count: parseInt(r.message_count, 10),
    created_at: daysAgo(r.created_days_ago),
  }));
}

export function loadTrackedContacts() {
  return parseCsv("tracked_contacts.csv").map((r) => ({
    id: parseInt(r.id, 10),
    name: r.name,
    phone: r.phone,
    description: nullable(r.description),
    enabled: r.enabled === "true",
    message_count: parseInt(r.message_count, 10),
    created_at: daysAgo(r.created_days_ago),
  }));
}
