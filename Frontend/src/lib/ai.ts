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

    const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-8b-8192"];

    for (let i = 0; i < models.length; i++) {
        try {
            const res = await fetch(GROQ_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: models[i],
                    messages,
                    max_tokens: maxTokens,
                    temperature: 0.3,
                }),
            });

            if (!res.ok) {
                if (res.status === 401) {
                    throw new Error("Invalid or expired Groq API key (401 Unauthorized). Please check/update your VITE_GROQ_API_KEY in Frontend/.env.local with a valid key from console.groq.com.");
                }
                const err = await res.json().catch(() => ({ error: { message: "Request failed" } }));
                
                // Fallback to next model if rate-limited (429)
                if (res.status === 429 && i < models.length - 1) {
                    console.warn(`Rate limit reached for ${models[i]}. Falling back to ${models[i+1]}...`);
                    continue;
                }
                throw new Error(err.error?.message || `Groq API error (${res.status})`);
            }

            const data = await res.json();
            return data.choices?.[0]?.message?.content || "";
        } catch (error: any) {
            const isRateLimit =
                error.message?.includes("rate limit") ||
                error.message?.includes("429") ||
                error.message?.includes("Rate limit");
            
            if (isRateLimit && i < models.length - 1) {
                console.warn(`Rate limit warning caught. Falling back from ${models[i]} to ${models[i+1]}...`);
                continue;
            }
            throw error;
        }
    }
    
    throw new Error("All Groq models failed due to rate limits. Please try again in a moment.");
}

// ─── Content Fetch Utilities ───────────────────────────────────────────────

export type ContentFetchResult = {
    content: string | null;
    source: "readme" | "blocked" | "not_found" | "invalid_url";
    error?: string;
};

/** Fetch repository metadata, file trees, dependencies, and code entry points (Fix 4). */
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

        // 1. Fetch Repository Metadata from GitHub API
        let metaText = "";
        let activeBranch = "main";
        try {
            const metaRes = await fetch(`https://api.github.com/repos/${user}/${repo}`, {
                headers: { Accept: "application/vnd.github.v3+json" },
                signal: AbortSignal.timeout(5000),
            });
            if (metaRes.ok) {
                const meta = await metaRes.json();
                activeBranch = meta.default_branch || "main";
                metaText = `## REPOSITORY METADATA
Description: ${meta.description || "No description"}
Stars: ${meta.stargazers_count || 0} | Forks: ${meta.forks_count || 0}
Primary Language: ${meta.language || "Unknown"}
Topics: ${meta.topics ? meta.topics.join(", ") : "None"}\n\n`;
            }
        } catch (e) {
            console.warn("Meta fetch failed", e);
        }

        // 2. Fetch Repository File Tree & Analyze Structure
        let treeText = "";
        let dependencyText = "";
        let codeSnippetsText = "";
        let readmeText = "";
        let readmeFound = false;

        try {
            const treeUrl = `https://api.github.com/repos/${user}/${repo}/git/trees/${activeBranch}?recursive=1`;
            const treeRes = await fetch(treeUrl, { signal: AbortSignal.timeout(7000) });
            if (treeRes.ok) {
                const treeData = await treeRes.json();
                const treeList = treeData.tree || [];

                // Build directory structure overview (up to 3 levels)
                const structureList = treeList
                    .map((f: any) => f.path)
                    .filter((p: string) => {
                        const depth = p.split("/").length;
                        const excluded = ["node_modules", "build", "dist", ".next", "__pycache__", ".git", "vendor", "venv", ".idea", ".vscode"].some(d => p.includes(d + "/"));
                        return depth <= 3 && !excluded;
                    })
                    .slice(0, 30);
                
                treeText = `## DIRECTORY STRUCTURE (3 Levels Deep)\n${structureList.join("\n")}\n\n`;

                // Search for README anywhere in the tree (case-insensitive)
                const readmeFile = treeList.find((f: any) => {
                    const pathLower = f.path.toLowerCase();
                    return pathLower === "readme.md" || pathLower.endsWith("/readme.md") ||
                           pathLower === "readme.txt" || pathLower.endsWith("/readme.txt") ||
                           pathLower === "readme.markdown" || pathLower.endsWith("/readme.markdown");
                });

                if (readmeFile) {
                    const readmeRawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${activeBranch}/${readmeFile.path}`;
                    try {
                        const res = await fetch(readmeRawUrl, { signal: AbortSignal.timeout(5000) });
                        if (res.ok) {
                            readmeText = await res.text();
                            readmeFound = true;
                        }
                    } catch (e) {
                        console.warn("Readme raw fetch failed", e);
                    }
                }

                // Detect dependency files
                const depFiles = treeList.filter((f: any) => {
                    const name = f.path.split("/").pop();
                    return ["package.json", "requirements.txt", "pyproject.toml", "pom.xml", "build.gradle", "Cargo.toml"].includes(name);
                }).slice(0, 3);

                for (const depFile of depFiles) {
                    const depRawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${activeBranch}/${depFile.path}`;
                    try {
                        const depRes = await fetch(depRawUrl, { signal: AbortSignal.timeout(5000) });
                        if (depRes.ok) {
                            const text = await depRes.text();
                            dependencyText += `### Dependency File: ${depFile.path}\n\`\`\`\n${text.slice(0, 1000)}\n\`\`\`\n\n`;
                        }
                    } catch { /* skip */ }
                }

                // Fetch core code entry points
                const coreFiles = treeList.filter((f: any) => {
                    const path = f.path.toLowerCase();
                    const isCode = path.endsWith(".py") || path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".go");
                    const isEntry = path.includes("main.") || path.includes("app.") || path.includes("index.") || path.includes("server.") || path.includes("manage.py");
                    const excluded = ["node_modules", "dist", "build", "venv", ".next"].some(d => path.includes(d + "/"));
                    return isCode && isEntry && !excluded;
                }).slice(0, 2);

                for (const cFile of coreFiles) {
                    const cRawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${activeBranch}/${cFile.path}`;
                    try {
                        const cRes = await fetch(cRawUrl, { signal: AbortSignal.timeout(5000) });
                        if (cRes.ok) {
                            const text = await cRes.text();
                            codeSnippetsText += `### Code Entry Point: ${cFile.path}\n\`\`\`\n${text.slice(0, 1000)}\n\`\`\`\n\n`;
                        }
                    } catch { /* skip */ }
                }
            }
        } catch (e) {
            console.warn("Tree fetch failed", e);
        }

        // Fallback: If git tree failed (rate-limited/blocked), try brute-forcing guesses at root level
        if (!readmeFound) {
            const branches = ["main", "master"];
            const readmeNames = ["README.md", "readme.md", "Readme.md"];
            for (const branch of branches) {
                for (const file of readmeNames) {
                    const rawUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${file}`;
                    try {
                        const res = await fetch(rawUrl, { signal: AbortSignal.timeout(5000) });
                        if (res.ok) {
                            readmeText = await res.text();
                            activeBranch = branch;
                            readmeFound = true;
                            break;
                        }
                    } catch { /* try next */ }
                }
                if (readmeFound) break;
            }
        }


        // Compile Enriched analysis payload
        if (metaText) contentParts.push(metaText);
        if (treeText) contentParts.push(treeText);
        if (dependencyText) contentParts.push(`## DETECTED MANIFESTS\n${dependencyText}`);
        if (codeSnippetsText) contentParts.push(`## CORE MODULES\n${codeSnippetsText}`);
        if (readmeText) contentParts.push(`## README\n${readmeText.slice(0, 2000)}`);

        if (contentParts.length === 0) {
            return { content: null, source: "not_found", error: "Repository is empty or unreadable" };
        }

        // Return compiled representation (limit total length to keep token usage optimized)
        return { content: contentParts.join("\n\n").slice(0, 7000), source: "readme" };
    } catch (err: any) {
        return { content: null, source: "blocked", error: err.message || "Fetch failed" };
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
            binary = new TextDecoder("latin1").decode(new Uint8Array(buf));
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
            content: `You are a hackathon judge AI. Evaluate the submission based on its product viability, utility, and implementation, rather than just code documentation.
DO NOT guess or invent information not present in the content.

Score based on these categories (each 0-100):
- Innovation & Uniqueness (JSON key "innovation"): novelty of the idea, creative approach, and uniqueness compared to existing alternatives.
- Usefulness & Utility (JSON key "technicalDepth"): how well the project solves a real-world problem, user value, and practical utility (evaluated higher than just well-documented code).
- Feasibility & Execution (JSON key "feasibility"): practicality, technical viability, and completeness of execution in the hackathon.
- Presentation & Clarity (JSON key "clarity"): documentation clarity, project pitch structure, and clarity of communication.

Return your response as valid JSON with this exact structure:
{
  "score": <overall score 0-100, weighted heavily towards usefulness, innovation, and feasibility>,
  "categories": {
    "innovation": <0-100>,
    "technicalDepth": <0-100>,
    "feasibility": <0-100>,
    "clarity": <0-100>
  },
  "summary": "<2-3 sentence objective summary focusing on the problem solved and product value>",
  "strengths": "<bullet points of strengths focusing on utility, innovation, uniqueness, and execution>",
  "weaknesses": "<bullet points of weaknesses focusing on competitor alternatives, gaps in utility, or execution stubs>"
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
            content: `You are a friendly, highly skilled, and conversational hackathon judge assistant. Think of yourself as a senior product manager or technical co-pilot sitting next to the judge.

Your main goal is to assist the judge in understanding the project's product viability, real-world utility, relevance, and functionality:
- Focus heavily on explaining **what the project does (functionality)**, its **real-world relevance**, **use cases**, **similar existing ideas**, and **competitive alternatives/advantages**.
- Judges rarely ask about lines of raw code, but they care deeply about architecture, implementation completeness, and practical uses.
- Use the provided repository codebase and README content to verify if features are actually built or just mocked, and to understand how the system works.

Your response formatting rules:
- **Format feature listings in clean, human-readable narrative text:** Never output raw, mechanical bullet points filled with code file references in parentheses (e.g. do NOT write "Creating events: Implemented (see app.py and models.py)"). Instead, describe their features in cohesive, well-written paragraphs (e.g. write: "The project has a complete Event Management system enabling users to create, update, and delete events, which are integrated with their data model.").
- When listing implemented vs. missing/mocked features, write about them like a technical partner talking in a meeting, explaining what works and what is a placeholder in a clear, fluent explanation.

Your tone should be:
- Conversational, natural, and engaging (e.g., "Ah, looking at their modules, they actually implemented...", "Oh, that's an interesting approach to their design...", "For alternatives, we usually see X, but they chose Y because...").
- Peer-to-peer (avoid sounding like a standard robotic AI, a dry bulleted FAQ list, or an academic evaluator. Do not start every sentence with "Based on the repository...").
- Honest and insightful (e.g. "Looking at the backend, the payment API seems to be a placeholder, but the core login flow is fully functional").

${repoContext}`,
        },
        ...conversationHistory,
        { role: "user", content: question },
    ];

    return chatCompletion(messages, 800);
}

// ─── Project Snapshot Generation ──────────────────────────────────────────

export interface ProjectFeature {
    name: string;
    status: "Working" | "Partially Implemented" | "Mocked/Planned" | "Unknown";
    details?: string;
}

export interface SnapshotResult {
    summary: string;
    techStack: string[];
    keyFeatures: string[];
    features?: ProjectFeature[];
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
Analyze the codebase structure, files, and README to identify key features and their implementation status:
- "Working": The feature has actual functional code implemented (e.g., active database models, API views, UI logic).
- "Partially Implemented": Some code is written but it is incomplete or half-implemented.
- "Mocked/Planned": Only static mockups, placeholders, or TODO comments exist for this feature, but it is not actually functional.

Return your response as valid JSON:
{
  "summary": "<3-4 sentence project summary>",
  "techStack": ["tech1", "tech2", "tech3"],
  "keyFeatures": ["feature1", "feature2", "feature3"],
  "features": [
    { "name": "Feature Name", "status": "Working", "details": "Short detail about implementation" },
    { "name": "Feature Name", "status": "Mocked/Planned", "details": "Short detail why it is mocked/planned" }
  ]
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
            features: [],
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

