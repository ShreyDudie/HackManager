// =============================================================================
// ai.ts — Features 4 & 5: LinkedIn post gen + real AI scoring with PDF text
// Groq API wrapper. Fetches actual README.md from GitHub.
// Extracts text from PDF base64. Structured per-category scoring.
// =============================================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function getApiKey(): string {
    return import.meta.env.VITE_GROQ_API_KEY || "";
}

export function isAIAvailable(): boolean {
    return getApiKey().length > 0;
}

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

async function chatCompletion(messages: ChatMessage[], maxTokens = 1024): Promise<string> {
    const key = getApiKey();
    if (!key) throw new Error("Groq API key not configured. Set VITE_GROQ_API_KEY in .env.local");

    const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            max_tokens: maxTokens,
            temperature: 0.3,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: "Request failed" } }));
        throw new Error(err.error?.message || `Groq API error (${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
}

// ─── Content Fetch Utilities ───────────────────────────────────────────────

export type ContentFetchResult = {
    content: string | null;
    source: "readme" | "blocked" | "not_found" | "invalid_url";
    error?: string;
};

/** Fetch README.md + code files from a public GitHub repo (Fix 4). */
export async function fetchRepoContent(repoUrl: string): Promise<ContentFetchResult> {
    if (!repoUrl || !repoUrl.includes("github.com")) {
        return { content: null, source: "invalid_url", error: "Not a GitHub URL" };
    }

    try {
        const url = new URL(repoUrl.trim());
        const parts = url.pathname.replace(/^\//, "").replace(/\/$/, "").split("/");
        if (parts.length < 2) {
            return { content: null, source: "invalid_url", error: "Cannot determine user/repo from URL" };
        }
        const [user, repo] = parts;
        const contentParts: string[] = [];

        // 1. Fetch README
        const branches = ["main", "master"];
        const readmeNames = ["README.md", "readme.md", "Readme.md"];
        let readmeFound = false;

        for (const branch of branches) {
            for (const file of readmeNames) {
                const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${file}`;
                try {
                    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(8000) });
                    if (res.ok) {
                        const text = await res.text();
                        contentParts.push(`# README\n${text.slice(0, 2000)}`);
                        readmeFound = true;
                        break;
                    }
                } catch { /* try next */ }
            }
            if (readmeFound) break;
        }

        // 2. Fix 4: Fetch actual code files via GitHub API
        const CODE_EXTENSIONS = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".rs", ".cpp", ".c"];
        const EXCLUDE_DIRS = ["node_modules", "build", "dist", ".next", "__pycache__", ".git", "vendor", "venv"];

        try {
            const apiUrl = `https://api.github.com/repos/${user}/${repo}/git/trees/main?recursive=1`;
            const treeRes = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
            if (!treeRes.ok) {
                // Try master branch
                const masterUrl = `https://api.github.com/repos/${user}/${repo}/git/trees/master?recursive=1`;
                const masterRes = await fetch(masterUrl, { signal: AbortSignal.timeout(10000) });
                if (masterRes.ok) {
                    const data = await masterRes.json();
                    await fetchCodeFiles(data, user, repo, "master", CODE_EXTENSIONS, EXCLUDE_DIRS, contentParts);
                }
            } else {
                const data = await treeRes.json();
                await fetchCodeFiles(data, user, repo, "main", CODE_EXTENSIONS, EXCLUDE_DIRS, contentParts);
            }
        } catch { /* GitHub API may be rate-limited, continue with README */ }

        if (contentParts.length === 0) {
            return { content: null, source: "not_found", error: "README.md not found on main/master branch" };
        }

        return { content: contentParts.join("\n\n").slice(0, 6000), source: "readme" };
    } catch (err: any) {
        return { content: null, source: "blocked", error: err.message || "Fetch failed" };
    }
}

/** Helper: fetch code files from GitHub tree (Fix 4) */
async function fetchCodeFiles(
    treeData: any, user: string, repo: string, branch: string,
    extensions: string[], excludeDirs: string[], contentParts: string[]
): Promise<void> {
    const files = (treeData.tree || []).filter((f: any) => {
        if (f.type !== "blob") return false;
        const path = f.path as string;
        if (excludeDirs.some((d) => path.includes(`${d}/`))) return false;
        return extensions.some((ext) => path.endsWith(ext));
    });

    // Pick up to 5 most relevant files (prefer shorter paths = core files)
    const sorted = files.sort((a: any, b: any) => (a.path as string).length - (b.path as string).length).slice(0, 5);

    for (const file of sorted) {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${file.path}`;
            const res = await fetch(rawUrl, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const text = await res.text();
                contentParts.push(`# File: ${file.path}\n${text.slice(0, 800)}`);
            }
        } catch { /* skip file */ }
    }
}

/** Validate PPT link accessibility. */
export async function validatePPTLink(pptUrl: string): Promise<ContentFetchResult> {
    if (!pptUrl) return { content: null, source: "invalid_url" };

    try {
        await fetch(pptUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(5000),
            mode: "no-cors",
        });
        return { content: "[Link is publicly accessible]", source: "readme" };
    } catch {
        return { content: null, source: "blocked", error: "PPT link is not publicly accessible" };
    }
}

// ─── Feature 5: PDF Text Extraction ────────────────────────────────────────

/** Unified async helper to extract text from a PDF (base64 or URL). */
export async function extractPDFContent(source: { base64?: string | null; url?: string | null }): Promise<string | null> {
    try {
        let binary = "";
        if (source.url) {
            const res = await fetch(source.url);
            if (!res.ok) return null;
            const buf = await res.arrayBuffer();
            binary = String.fromCharCode(...new Uint8Array(buf));
        } else if (source.base64) {
            const raw = source.base64.includes(",") ? source.base64.split(",")[1] : source.base64;
            binary = atob(raw);
        } else {
            return null;
        }

        // Use the heuristic extractor
        return doExtractText(binary);
    } catch (e) {
        console.error("PDF Extraction Error:", e);
        return null;
    }
}

function doExtractText(binary: string): string {
    const textMatches: string[] = [];
    const regex = /\(([^)]{2,})\)/g;
    let match;
    while ((match = regex.exec(binary)) !== null) {
        const text = match[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
        if (/^[\x20-\x7E\n\r\t]+$/.test(text) && text.length > 3) {
            textMatches.push(text);
        }
    }
    return textMatches.join(" ").slice(0, 4000);
}

/** Legacy sync version */
export function extractPDFText(base64Data: string): string {
    return doExtractText(atob(base64Data.includes(",") ? base64Data.split(",")[1] : base64Data));
}

// ─── Feature 5: Enhanced PPT Evaluation with Structured Scoring ────────────

export interface PPTEvaluation {
    score: number;
    summary: string;
    strengths: string;
    weaknesses: string;
    categories?: {
        innovation: number;
        technicalDepth: number;
        feasibility: number;
        clarity: number;
    };
}

/**
 * Evaluate a submission using REAL fetched content.
 * Feature 5: Now includes per-category scoring and accepts PDF text.
 */
export async function evaluatePPT(
    pptName: string,
    pptLink: string,
    teamName: string,
    repoContent?: string | null,
    pdfText?: string | null
): Promise<PPTEvaluation> {
    const contentParts: string[] = [];

    if (repoContent) {
        contentParts.push(`\nREPOSITORY README CONTENT:\n${repoContent}`);
    }
    if (pdfText && pdfText !== "[No readable text extracted from PDF]" && pdfText !== "[PDF text extraction failed]") {
        contentParts.push(`\nPDF PRESENTATION CONTENT:\n${pdfText}`);
    }
    if (contentParts.length === 0) {
        contentParts.push("\n[No actual content available — evaluate based on submission metadata only. Score conservatively.]");
    }

    const response = await chatCompletion([
        {
            role: "system",
            content: `You are a hackathon judge AI. Evaluate the submission based on ACTUAL content provided.
DO NOT guess or invent information not present in the content.
Score based on these categories (each 0-100):
- Innovation: novelty of the idea and approach
- Technical Depth: complexity, architecture quality, tech stack
- Feasibility: practicality, real-world applicability
- Clarity: documentation, presentation quality, explanation

Return your response as valid JSON with this exact structure:
{
  "score": <overall score 0-100>,
  "categories": {
    "innovation": <0-100>,
    "technicalDepth": <0-100>,
    "feasibility": <0-100>,
    "clarity": <0-100>
  },
  "summary": "<2-3 sentence objective summary>",
  "strengths": "<bullet points of strengths based on actual content>",
  "weaknesses": "<bullet points of weaknesses or missing information>"
}
Only return the JSON, no markdown code blocks.`,
        },
        {
            role: "user",
            content: `Evaluate this hackathon submission:
Team: ${teamName}
PPT Name: ${pptName}
PPT Link: ${pptLink}${contentParts.join("")}`,
        },
    ]);

    // Fix 3: Robust JSON parsing with retry
    let parsed: PPTEvaluation | null = null;
    const parseJsonSafe = (text: string): PPTEvaluation | null => {
        try {
            // Strip markdown code fences
            let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            // Try to find JSON object in the response
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) cleaned = jsonMatch[0];
            const obj = JSON.parse(cleaned);
            // Validate & coerce numeric fields
            return {
                score: Math.max(0, Math.min(100, Number(obj.score) || 50)),
                categories: obj.categories ? {
                    innovation: Math.max(0, Math.min(100, Number(obj.categories.innovation) || 50)),
                    technicalDepth: Math.max(0, Math.min(100, Number(obj.categories.technicalDepth) || 50)),
                    feasibility: Math.max(0, Math.min(100, Number(obj.categories.feasibility) || 50)),
                    clarity: Math.max(0, Math.min(100, Number(obj.categories.clarity) || 50)),
                } : undefined,
                summary: String(obj.summary || "").slice(0, 500),
                strengths: String(obj.strengths || "").slice(0, 500),
                weaknesses: String(obj.weaknesses || "").slice(0, 500),
            };
        } catch { return null; }
    };

    parsed = parseJsonSafe(response);

    // Fix 3: Retry once if parsing failed
    if (!parsed) {
        try {
            const retryResponse = await chatCompletion([
                { role: "system", content: "You previously returned an invalid JSON response. Return ONLY valid JSON with this structure: {\"score\": number, \"categories\": {\"innovation\": number, \"technicalDepth\": number, \"feasibility\": number, \"clarity\": number}, \"summary\": string, \"strengths\": string, \"weaknesses\": string}. No markdown, no explanation, ONLY the JSON object." },
                { role: "user", content: `Previous response was: ${response.slice(0, 500)}\nPlease fix and return valid JSON only.` },
            ]);
            parsed = parseJsonSafe(retryResponse);
        } catch { /* give up */ }
    }

    // Final fallback — never show raw broken AI response
    return parsed || {
        score: 50,
        summary: "AI evaluation completed but response could not be parsed. Please retry.",
        strengths: "Unable to determine — retry evaluation",
        weaknesses: "Unable to determine — retry evaluation",
    };
}

// ─── Repo Question Chatbot ─────────────────────────────────────────────────

export async function chatWithRepo(
    repoUrl: string,
    question: string,
    conversationHistory: ChatMessage[] = [],
    repoContent?: string | null
): Promise<string> {
    // Fix 4: context now includes actual code files, not just README
    const repoContext = repoContent
        ? `Repository content (README + code files):\n${repoContent}\n\nAnalyze the repository structure and actual code logic. Reference specific files and code when answering.`
        : `Repository URL: ${repoUrl}\nNote: Repository content could not be fetched. Be explicit about this limitation.`;

    // Fix 8: handle empty question gracefully
    if (!question || !question.trim()) {
        return "Please ask a specific question about the repository.";
    }

    const messages: ChatMessage[] = [
        {
            role: "system",
            content: `You are a technical code reviewer and hackathon judge assistant.\n${repoContext}`,
        },
        ...conversationHistory,
        { role: "user", content: question },
    ];

    return chatCompletion(messages, 800);
}

// ─── Project Snapshot Generation ──────────────────────────────────────────

export interface SnapshotResult {
    summary: string;
    techStack: string[];
    keyFeatures: string[];
}

export async function generateProjectSnapshot(
    repoUrl: string,
    pptName: string,
    teamName: string,
    repoContent?: string | null
): Promise<SnapshotResult> {
    const contentSection = repoContent
        ? `\n\nREADME Content:\n${repoContent}`
        : "";

    const response = await chatCompletion([
        {
            role: "system",
            content: `You are a hackathon project analyzer. Generate a concise project snapshot.
Return your response as valid JSON:
{
  "summary": "<3-4 sentence project summary>",
  "techStack": ["tech1", "tech2", "tech3"],
  "keyFeatures": ["feature1", "feature2", "feature3"]
}
Base your analysis on the actual content provided, not guesses.
Only return the JSON, no markdown code blocks.`,
        },
        {
            role: "user",
            content: `Team: ${teamName}
Repository: ${repoUrl}
Presentation: ${pptName}${contentSection}`,
        },
    ], 600);

    try {
        const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleaned) as SnapshotResult;
    } catch {
        return {
            summary: response.slice(0, 300),
            techStack: ["Unable to determine"],
            keyFeatures: ["Unable to determine"],
        };
    }
}

// ─── Helpline Chatbot ─────────────────────────────────────────────────────

export async function helplineChat(
    question: string,
    conversationHistory: ChatMessage[] = []
): Promise<string> {
    // Fix 6: Graceful empty input handling
    if (!question || !question.trim()) {
        return "Please type a question or describe your issue.";
    }

    const messages: ChatMessage[] = [
        {
            role: "system",
            content: `You are a helpful hackathon support assistant. Answer questions about:
- Registration process and team member requirements
- PPT submission guidelines and link formats
- QR code generation and usage
- Face verification process
- Team rules (size, naming)
- Technical issues
Be concise, friendly, and helpful.
If the user explicitly says something like "create ticket", "open ticket", or "I need to file a complaint", respond with exactly:
ACTION:CREATE_TICKET|<subject>|<category>
where category is one of: Registration, PPT, Verification, Other
Otherwise, NEVER use the ACTION:CREATE_TICKET format. Just answer normally.`,
        },
        ...conversationHistory,
        { role: "user", content: question },
    ];

    try {
        const response = await chatCompletion(messages, 500);
        return response || "I'm sorry, I couldn't process that. Please try again.";
    } catch (err: any) {
        return `Sorry, I'm having trouble connecting. Error: ${err?.message || "Unknown error"}`;
    }
}

// ─── Feature 4: LinkedIn Post Generation ──────────────────────────────────────

export interface LinkedInPostData {
    eventName: string;
    teamName: string;
    position: string;     // Winner / Runner-Up / Finalist / Participant
    techStack: string;
    githubUrl: string;
    college: string;
    userName: string;
    rank?: number;
    totalTeams?: number;
    projectName?: string;
    problemStatement?: string;
    role?: "Participant" | "Winner" | "Organizer";
}

export async function generateLinkedInPost(input: LinkedInPostData): Promise<string> {
    const role = input.role || (input.position.toLowerCase().includes("winner") ? "Winner" : "Participant");

    const roleGuide: Record<string, string> = {
        "Winner": `This person WON the hackathon! Use a TRIUMPHANT, celebratory tone.
- Lead with the achievement (🥇 / 🏆)
- Emphasize the journey from idea to winning solution`,
        "Participant": `This person PARTICIPATED. Use a GRATEFUL, learning-focused tone.
- Lead with the experience and community (🎓)
- Focus on skills learned and connections made`,
        "Organizer": `This person was an ORGANIZER. Use a LEADERSHIP and SUCCESS-oriented tone.
- Lead with the impact of the event (🚀)
- Highlight the talent and energy of the participants`
    };

    const roleContext = roleGuide[role] || roleGuide["Participant"];

    const response = await chatCompletion([
        {
            role: "system",
            content: `You are a professional LinkedIn post writer. 
Generate a professional, engaging, and enthusiastic post.
Include relevant emojis, hashtags (#Hackathon #Coding #Innovation), and a call to action.
${roleContext}`
        },
        {
            role: "user",
            content: `Generate a post for:
- Name: ${input.userName}
- Event: ${input.eventName}
- Team: ${input.teamName}
- Project: ${input.projectName || "Not specified"}
- Role: ${role}
- Tech Stack: ${input.techStack}
- GitHub: ${input.githubUrl}
- College: ${input.college}`
        }
    ], 600);

    return response.trim() || "I'm sorry, I couldn't process that. Please try again.";
}

