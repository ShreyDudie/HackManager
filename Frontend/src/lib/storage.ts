// =============================================================================
// storage.ts — Centralized localStorage data layer (v2 — multi-hackathon patch)
// All hackathon data (except auth) flows through these helpers.
// Schema is backward-compatible — migration runs automatically on first read.
// =============================================================================

/* ─── Type Definitions ─── */

export interface Hackathon {
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    registrationDeadline: string;
    minTeamSize: string;
    maxTeamSize: string;
    rounds: Round[];
    status: "Open" | "Ongoing" | "Completed" | "Coming Soon";
    theme: string;
    date: string;
    teams: number;
    desc: string;
    rules: string;
    criteria: EvalCriteria[];
    aiWeight: number;
}

export interface Round {
    id: string;
    name: string;
    description: string;
    deadline: string;
    submissionType: "PPT" | "GitHub" | "Form";
    shortlist: boolean;
}

export interface EvalCriteria {
    id: string;
    name: string;
    weight: number;
}

// NEW: per team-member detail + individual verification
export interface TeamMember {
    name: string;
    email: string;                // Feature 3: teammate email for cross-linking
    phone: string;
    college: string;
    faceEncoding: string | null;   // base64 JPEG for face comparison
    verificationStatus: boolean;
}

// Feature 2: Grievance system (Mapped to Ticket in v2)
export interface Grievance {
    id: string;
    userEmail: string;
    userName: string;
    hackathonId: string;
    hackathonName: string;
    title: string;
    description: string;
    category: "Registration" | "PPT" | "Verification" | "Technical" | "Other";
    status: "Open" | "In Progress" | "Resolved";
    response: string | null;     // admin response
    createdAt: string;
    updatedAt: string;
}

// Feature 4: cached LinkedIn post
export interface LinkedInPost {
    userEmail: string;
    hackathonId: string;
    content: string;
    generatedAt: string;
}

export interface Registration {
    id: string;
    userName: string;
    userEmail: string;
    teamName: string;
    // memberNames kept for backward compat — migrated to members[] on read
    memberNames: string[];
    // NEW: rich member objects (replaces memberNames for new registrations)
    members: TeamMember[];
    hackathonId: string;
    hackathonName: string;
    timestamp: string;
    status: "In Process" | "Shortlisted" | "Rejected" | "Verified";
    faceImage: string | null;
    qrTokenUsed: boolean;
    scannedAt?: string;             // NEW: track scan time
}

export interface GitHubSubmission {
    hackathonId: string;
    userEmail: string;
    url: string;
    submittedAt: string;
}

export interface PPTSubmission {
    hackathonId: string;
    userEmail: string;
    roundId: string;
    name: string;
    link: string;
    pdfBase64: string | null;   // legacy
    pdfUrl: string | null;      // NEW: remote URL from API
    pdfFileName: string | null;
    submittedAt: string;
}

// Fix 2: QR scan log for admin monitoring
export interface QRScanLog {
    id: string;
    hackathonId: string;
    userEmail: string;
    teamName: string;
    tokenType: "registration" | "breakfast" | "lunch" | "dinner";
    tokenHash: string;
    result: "valid" | "invalid" | "duplicate" | "expired";
    scannedAt: string;
}

export interface QRToken {
    id: string;
    hackathonId: string;
    userEmail: string;
    type: "registration" | "breakfast" | "lunch" | "dinner";
    day: number;
    token: string;
    used: boolean;
    createdAt: string;
}

export interface Notification {
    id: string;
    hackathonId: string;
    title: string;
    message: string;
    date: string;
}

export interface Ticket {
    id: string;
    subject: string;
    category: string;
    status: "Open" | "In Progress" | "Resolved";
    studentName: string;
    studentEmail: string;
    hackathonId: string;   // NEW — defaults to "global" for old tickets
    messages: TicketMessage[];
    createdAt: string;
}

export interface TicketMessage {
    from: "student" | "admin";
    text: string;
    time: string;
}

export interface JudgeAssignment {
    hackathonId: string;
    judgeEmail: string;
    judgeName: string;
    teamName: string;
    teamId: string;
    pptLink: string | null;
    pptName: string | null;
    githubUrl: string | null;
    // NEW: actual fetched content for AI
    repoContent: string | null;
    pptContent: string | null;
    aiScore: number | null;
    aiSummary: string | null;
    aiStrengths: string | null;
    aiWeaknesses: string | null;
    judgeScore: number | null;
    status: "Pending" | "Evaluated";
}

export interface ProjectFeature {
    name: string;
    status: "Working" | "Partially Implemented" | "Mocked/Planned" | "Unknown";
    details?: string;
}

export interface ProjectSnapshot {
    teamId: string;
    hackathonId: string;
    summary: string;
    techStack: string[];
    keyFeatures: string[];
    features?: ProjectFeature[];
    cachedAt: string;
}

// NEW: named judge stored per hackathon
export interface Judge {
    id: string;
    name: string;
    email: string;
    hackathonId: string;
}

// NEW: cached AI evaluation (keyed by submissionId = `${hackathonId}_${teamId}`)
export interface AiEvaluation {
    submissionId: string;
    score: number;
    summary: string;
    strengths: string;
    weaknesses: string;
    cachedAt: string;
    repoFetched: boolean;
    contentSource: "readme" | "title_guess" | "blocked";
}

// NEW: simulated external hackathon (Unstop-style)
export interface ExternalHackathon {
    id: string;
    name: string;
    organizer: string;
    prizePool: string;
    deadline: string;
    url: string;
    theme: string;
}

/* ─── Storage Keys ─── */
const KEYS = {
    HACKATHONS: "sq_hackathons",
    REGISTRATIONS: "sq_registrations",
    GITHUB_SUBMISSIONS: "sq_github_submissions",
    PPT_SUBMISSIONS: "sq_ppt_submissions",
    QR_TOKENS: "sq_qr_tokens",
    NOTIFICATIONS: "sq_notifications",
    TICKETS: "sq_tickets",
    JUDGE_ASSIGNMENTS: "sq_judge_assignments",
    PROJECT_SNAPSHOTS: "sq_project_snapshots",
    JUDGES: "sq_judges",           // NEW
    AI_CACHE: "sq_ai_cache",         // NEW
    EXTERNAL_HACKATHONS: "sq_external_hackathons", // NEW
    QR_SCAN_LOGS: "sq_qr_scan_logs",     // Fix 2
    GRIEVANCES: "sq_grievances",          // Feature 2
    LINKEDIN_POSTS: "sq_linkedin_posts",      // Feature 4
} as const;

/* ─── Generic Safe Helpers ─── */

/** Safely read a JSON array — never crashes */
function readArray<T>(key: string): T[] {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
        return [];
    }
}

/** Safely read a JSON object — never crashes */
function readObject<T extends object>(key: string): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {} as T;
        const parsed = JSON.parse(raw);
        return (typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}) as T;
    } catch {
        return {} as T;
    }
}

/** Write a JSON array */
function writeArray<T>(key: string, data: T[]): void {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn("localStorage write failed:", e);
    }
}

/** Write a JSON object */
function writeObject<T>(key: string, data: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn("localStorage write failed:", e);
    }
}

/* ================================================================
   HACKATHONS
   ================================================================ */

export function getHackathons(): Hackathon[] {
    // Migrate legacy "global_hackathons" format
    const legacy = readArray<any>("global_hackathons");
    const current = readArray<Hackathon>(KEYS.HACKATHONS);
    if (legacy.length > 0 && current.length === 0) {
        const migrated: Hackathon[] = legacy.map((h: any) => ({
            id: h.id || crypto.randomUUID().slice(0, 8),
            name: h.name || "Unnamed",
            description: h.description || h.desc || "",
            startDate: h.startDate || "",
            endDate: h.endDate || "",
            registrationDeadline: h.registrationDeadline || "",
            minTeamSize: h.minTeamSize || "2",
            maxTeamSize: h.maxTeamSize || "5",
            rounds: h.rounds || [],
            status: h.status || "Open",
            theme: h.theme || "General",
            date: h.date || "",
            teams: h.teams || 0,
            desc: h.desc || h.description || "",
            rules: h.rules || "",
            criteria: h.criteria || [],
            aiWeight: h.aiWeight ?? 50,
        }));
        writeArray(KEYS.HACKATHONS, migrated);
        return migrated;
    }
    return current;
}

export function createHackathon(hackathon: Hackathon): void {
    const all = getHackathons();
    all.unshift(hackathon);
    writeArray(KEYS.HACKATHONS, all);
    localStorage.setItem("global_hackathons", JSON.stringify(all));
}

export function updateHackathon(id: string, updates: Partial<Hackathon>): void {
    const all = getHackathons();
    const idx = all.findIndex((h) => h.id === id);
    if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        writeArray(KEYS.HACKATHONS, all);
        localStorage.setItem("global_hackathons", JSON.stringify(all));
    }
}

export function getHackathon(id: string): Hackathon | undefined {
    return getHackathons().find((h) => h.id === id);
}

/** NEW: Delete hackathon and all its related data */
export function deleteHackathon(id: string): void {
    // Remove hackathon
    const hackathons = getHackathons().filter((h) => h.id !== id);
    writeArray(KEYS.HACKATHONS, hackathons);
    localStorage.setItem("global_hackathons", JSON.stringify(hackathons));

    // Remove registrations for this hackathon
    const regs = readArray<Registration>(KEYS.REGISTRATIONS).filter((r) => r.hackathonId !== id);
    writeArray(KEYS.REGISTRATIONS, regs);

    // Remove judge assignments
    const ja = readArray<JudgeAssignment>(KEYS.JUDGE_ASSIGNMENTS).filter((a) => a.hackathonId !== id);
    writeArray(KEYS.JUDGE_ASSIGNMENTS, ja);

    // Remove notifications
    const notifs = readArray<Notification>(KEYS.NOTIFICATIONS).filter((n) => n.hackathonId !== id);
    writeArray(KEYS.NOTIFICATIONS, notifs);

    // Remove QR tokens
    const qr = readArray<QRToken>(KEYS.QR_TOKENS).filter((t) => t.hackathonId !== id);
    writeArray(KEYS.QR_TOKENS, qr);

    // Remove project snapshots
    const snaps = readArray<ProjectSnapshot>(KEYS.PROJECT_SNAPSHOTS).filter((s) => s.hackathonId !== id);
    writeArray(KEYS.PROJECT_SNAPSHOTS, snaps);

    // Remove tickets for this hackathon
    const tickets = readArray<Ticket>(KEYS.TICKETS).filter((t) => t.hackathonId !== id);
    writeArray(KEYS.TICKETS, tickets);

    // Remove AI cache for this hackathon
    const cache = readArray<AiEvaluation>(KEYS.AI_CACHE).filter((c) => !c.submissionId.startsWith(id + "_"));
    writeArray(KEYS.AI_CACHE, cache);

    // Remove judges for this hackathon
    const judgesObj = readObject<Record<string, Judge[]>>(KEYS.JUDGES);
    delete judgesObj[id];
    writeObject(KEYS.JUDGES, judgesObj);
}

/* ================================================================
   REGISTRATIONS
   ================================================================ */

/** Migrate old memberNames[] → members[] with TeamMember objects */
function migrateRegistration(r: any): Registration {
    const members: TeamMember[] = r.members && Array.isArray(r.members)
        ? r.members.map((m: any) => ({
            name: m.name || m || "",
            phone: m.phone || "",
            college: m.college || "",
            faceEncoding: m.faceEncoding || null,
            verificationStatus: m.verificationStatus || false,
        }))
        : (r.memberNames || []).map((name: string) => ({
            name,
            phone: "",
            college: "",
            faceEncoding: null,
            verificationStatus: false,
        }));

    return {
        id: r.id || crypto.randomUUID().slice(0, 8),
        userName: r.userName || "",
        userEmail: r.userEmail || "",
        teamName: r.teamName || "",
        memberNames: r.memberNames || [],
        members,
        hackathonId: r.hackathonId || "",
        hackathonName: r.hackathonName || "",
        timestamp: r.timestamp || new Date().toISOString(),
        status: r.status || "In Process",
        faceImage: r.faceImage || null,
        qrTokenUsed: r.qrTokenUsed || false,
    };
}

export function getRegistrations(hackathonId?: string): Registration[] {
    // Migrate legacy single-format
    const legacySingle = readArray<any>("user_registrations");
    const current = readArray<any>(KEYS.REGISTRATIONS);

    if (legacySingle.length > 0 && current.length === 0) {
        const migrated = legacySingle.map(migrateRegistration);
        writeArray(KEYS.REGISTRATIONS, migrated);
    }

    const result = readArray<any>(KEYS.REGISTRATIONS).map(migrateRegistration);
    if (hackathonId) return result.filter((r) => r.hackathonId === hackathonId);
    return result;
}

/** Get ALL registrations for a specific user (multi-hackathon support)
 *  Feature 3: Also finds registrations where user is listed as a team member by email */
export function getUserRegistrations(userEmail: string): Registration[] {
    const all = getRegistrations();
    const directRegs = all.filter((r) => r.userEmail === userEmail);
    // Cross-link: find registrations where this user's email appears in members[].email
    const memberRegs = all.filter(
        (r) => r.userEmail !== userEmail &&
            r.members?.some((m) => m.email === userEmail) &&
            !directRegs.some((dr) => dr.hackathonId === r.hackathonId)
    );
    return [...directRegs, ...memberRegs];
}

/** Find registration for specific user + hackathon (Fix 1: also checks member emails) */
export function findRegistration(userEmail: string, hackathonId: string): Registration | undefined {
    const all = getRegistrations();
    // Direct match first
    const direct = all.find((r) => r.userEmail === userEmail && r.hackathonId === hackathonId);
    if (direct) return direct;
    // Cross-link: user may be a team member
    return all.find(
        (r) => r.hackathonId === hackathonId && r.members?.some((m) => m.email === userEmail)
    );
}

/** Find the FIRST registration for a user (Fix 1: also checks member emails) */
export function findUserRegistration(userEmail: string): Registration | undefined {
    const all = getRegistrations();
    const direct = all.find((r) => r.userEmail === userEmail);
    if (direct) return direct;
    return all.find((r) => r.members?.some((m) => m.email === userEmail));
}

export function addRegistration(reg: Registration): void {
    const all = readArray<Registration>(KEYS.REGISTRATIONS);
    // Fix 6: prevent duplicate registration for same user + hackathon
    const exists = all.some((r) => r.userEmail === reg.userEmail && r.hackathonId === reg.hackathonId);
    if (exists) return;
    all.push(reg);
    writeArray(KEYS.REGISTRATIONS, all);
    // Update legacy key
    const legacy = readArray<any>("user_registrations");
    legacy.push({
        userName: reg.userName,
        userEmail: reg.userEmail,
        teamName: reg.teamName,
        hackathonName: reg.hackathonName,
        hackathonId: reg.hackathonId,
        timestamp: reg.timestamp,
    });
    localStorage.setItem("user_registrations", JSON.stringify(legacy));
    // Increment team count
    const h = getHackathon(reg.hackathonId);
    if (h) updateHackathon(h.id, { teams: (h.teams || 0) + 1 });
}

export function updateRegistration(id: string, updates: Partial<Registration>): void {
    const all = readArray<any>(KEYS.REGISTRATIONS).map(migrateRegistration);
    const idx = all.findIndex((r) => r.id === id);
    if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        writeArray(KEYS.REGISTRATIONS, all);
    }
}

/** NEW: Update a single team member's verification status */
export function updateMemberVerification(
    regId: string,
    memberIdx: number,
    verificationStatus: boolean,
    faceEncoding?: string | null
): void {
    const all = readArray<any>(KEYS.REGISTRATIONS).map(migrateRegistration);
    const regIdx = all.findIndex((r) => r.id === regId);
    if (regIdx !== -1) {
        const reg = all[regIdx];
        if (reg.members && reg.members[memberIdx] !== undefined) {
            reg.members[memberIdx] = {
                ...reg.members[memberIdx],
                verificationStatus,
                ...(faceEncoding !== undefined ? { faceEncoding } : {}),
            };
            // If ALL members verified → mark team as Verified
            const allVerified = reg.members.every((m: TeamMember) => m.verificationStatus);
            if (allVerified) reg.status = "Verified";
            all[regIdx] = reg;
            writeArray(KEYS.REGISTRATIONS, all);
        }
    }
}

/** Fix 2: Remove a team member by index (only creator can call). Cannot remove self (idx 0). */
export function removeTeamMember(regId: string, memberIdx: number): boolean {
    if (memberIdx <= 0) return false; // Cannot remove creator (member 0)
    const all = readArray<any>(KEYS.REGISTRATIONS).map(migrateRegistration);
    const regIdx = all.findIndex((r) => r.id === regId);
    if (regIdx === -1) return false;
    const reg = all[regIdx];
    if (!reg.members || memberIdx >= reg.members.length) return false;
    reg.members.splice(memberIdx, 1);
    reg.memberNames = reg.members.map((m: TeamMember) => m.name);
    all[regIdx] = reg;
    writeArray(KEYS.REGISTRATIONS, all);
    return true;
}

/** Fix 2: Update a team member's editable fields */
export function updateTeamMember(regId: string, memberIdx: number, updates: Partial<TeamMember>): void {
    const all = readArray<any>(KEYS.REGISTRATIONS).map(migrateRegistration);
    const regIdx = all.findIndex((r) => r.id === regId);
    if (regIdx === -1) return;
    const reg = all[regIdx];
    if (!reg.members || memberIdx >= reg.members.length) return;
    reg.members[memberIdx] = { ...reg.members[memberIdx], ...updates };
    reg.memberNames = reg.members.map((m: TeamMember) => m.name);
    all[regIdx] = reg;
    writeArray(KEYS.REGISTRATIONS, all);
}

/** Fix 5: Lock entry QR — sets qrTokenUsed=true. Returns false if already locked (duplicate). */
export function lockEntryQR(userEmail: string, hackathonId: string): boolean {
    const all = readArray<any>(KEYS.REGISTRATIONS).map(migrateRegistration);
    const regIdx = all.findIndex((r) => r.userEmail === userEmail && r.hackathonId === hackathonId);
    if (regIdx === -1) return false;
    if (all[regIdx].qrTokenUsed) return false; // Already scanned — duplicate
    all[regIdx].qrTokenUsed = true;
    all[regIdx].scannedAt = new Date().toISOString();
    writeArray(KEYS.REGISTRATIONS, all);
    return true;
}

/* ================================================================
   GITHUB SUBMISSIONS
   ================================================================ */

export function getGitHubSubmission(userEmail: string, hackathonId: string): GitHubSubmission | undefined {
    return readArray<GitHubSubmission>(KEYS.GITHUB_SUBMISSIONS).find(
        (s) => s.userEmail === userEmail && s.hackathonId === hackathonId
    );
}

export function getGitHubSubmissions(hackathonId?: string): GitHubSubmission[] {
    const all = readArray<GitHubSubmission>(KEYS.GITHUB_SUBMISSIONS);
    if (hackathonId) return all.filter((s) => s.hackathonId === hackathonId);
    return all;
}

export function setGitHubSubmission(sub: GitHubSubmission): void {
    const all = readArray<GitHubSubmission>(KEYS.GITHUB_SUBMISSIONS);
    const idx = all.findIndex(
        (s) => s.userEmail === sub.userEmail && s.hackathonId === sub.hackathonId
    );
    if (idx !== -1) { all[idx] = sub; } else { all.push(sub); }
    writeArray(KEYS.GITHUB_SUBMISSIONS, all);

    // Automatically invalidate judge's AI cache and snapshots for this team
    invalidateSubmissionCache(sub.hackathonId, sub.userEmail);
}

/* ================================================================
   PPT SUBMISSIONS
   ================================================================ */

export function getPPTSubmissions(userEmail: string, hackathonId: string): PPTSubmission[] {
    return readArray<PPTSubmission>(KEYS.PPT_SUBMISSIONS).filter(
        (s) => s.userEmail === userEmail && s.hackathonId === hackathonId
    );
}

export function getAllPPTSubmissions(hackathonId?: string): PPTSubmission[] {
    const all = readArray<PPTSubmission>(KEYS.PPT_SUBMISSIONS);
    if (hackathonId) return all.filter((s) => s.hackathonId === hackathonId);
    return all;
}

export function setPPTSubmission(sub: PPTSubmission): void {
    const all = readArray<PPTSubmission>(KEYS.PPT_SUBMISSIONS);
    const idx = all.findIndex(
        (s) => s.userEmail === sub.userEmail && s.hackathonId === sub.hackathonId && s.roundId === sub.roundId
    );
    if (idx !== -1) { all[idx] = sub; } else { all.push(sub); }
    writeArray(KEYS.PPT_SUBMISSIONS, all);

    // Automatically invalidate judge's AI cache and snapshots for this team
    invalidateSubmissionCache(sub.hackathonId, sub.userEmail);
}

export function invalidateSubmissionCache(hackathonId: string, userEmail: string): void {
    const reg = findRegistration(userEmail, hackathonId);
    const regId = reg?.id || "";

    // Construct all candidate emails for this team (lead + members)
    const emails = [userEmail];
    if (reg) {
        if (reg.userEmail && !emails.includes(reg.userEmail)) {
            emails.push(reg.userEmail);
        }
        if (reg.members) {
            reg.members.forEach((m) => {
                if (m.email && !emails.includes(m.email)) {
                    emails.push(m.email);
                }
            });
        }
    }

    // 1. Delete from AI Cache
    const allAiCache = readArray<AiEvaluation>(KEYS.AI_CACHE);
    const filteredAiCache = allAiCache.filter((c) => {
        const isMatch =
            c.submissionId === `${hackathonId}_${userEmail}` ||
            (regId ? c.submissionId === `${hackathonId}_${regId}` : false) ||
            emails.some((email) => c.submissionId === `${hackathonId}_${email}`);
        return !isMatch;
    });
    writeArray(KEYS.AI_CACHE, filteredAiCache);

    // 2. Delete from Project Snapshots
    const allSnapshots = readArray<ProjectSnapshot>(KEYS.PROJECT_SNAPSHOTS);
    const filteredSnapshots = allSnapshots.filter((s) => {
        if (s.hackathonId !== hackathonId) return true;
        const isMatch =
            s.teamId === userEmail ||
            (regId ? s.teamId === regId : false) ||
            emails.includes(s.teamId);
        return !isMatch;
    });
    writeArray(KEYS.PROJECT_SNAPSHOTS, filteredSnapshots);

    // Get up-to-date github/ppt details for this team
    const githubs = readArray<GitHubSubmission>(KEYS.GITHUB_SUBMISSIONS);
    const subGithub = githubs.find((g) => g.hackathonId === hackathonId && emails.includes(g.userEmail));
    const newGithubUrl = subGithub?.url || null;

    const ppts = getAllPPTSubmissions(hackathonId);
    const subPpt = ppts.find((p) => emails.includes(p.userEmail));
    const newPptName = subPpt?.name || null;
    const newPptLink = subPpt?.link || null;

    // 3. Reset Judge Assignments
    const allAssignments = readArray<JudgeAssignment>(KEYS.JUDGE_ASSIGNMENTS);
    let changed = false;
    const updatedAssignments = allAssignments.map((a) => {
        const isMatch =
            a.hackathonId === hackathonId &&
            (a.teamId === userEmail || (regId && a.teamId === regId) || emails.includes(a.teamId));

        if (isMatch) {
            changed = true;
            return {
                ...a,
                aiScore: null,
                aiSummary: null,
                aiStrengths: null,
                aiWeaknesses: null,
                repoContent: null,
                pptContent: null,
                githubUrl: newGithubUrl,
                pptName: newPptName,
                pptLink: newPptLink,
            };
        }
        return a;
    });
    if (changed) {
        writeArray(KEYS.JUDGE_ASSIGNMENTS, updatedAssignments);
    }
}

/* ================================================================
   QR TOKENS
   ================================================================ */

export function getQRTokens(userEmail: string, hackathonId: string): QRToken[] {
    return readArray<QRToken>(KEYS.QR_TOKENS).filter(
        (t) => t.userEmail === userEmail && t.hackathonId === hackathonId
    );
}

export function addQRToken(token: QRToken): void {
    const all = readArray<QRToken>(KEYS.QR_TOKENS);
    all.push(token);
    writeArray(KEYS.QR_TOKENS, all);
}

export function markQRUsed(tokenId: string): void {
    const all = readArray<QRToken>(KEYS.QR_TOKENS);
    const idx = all.findIndex((t) => t.id === tokenId);
    if (idx !== -1) {
        all[idx].used = true;
        writeArray(KEYS.QR_TOKENS, all);
    }
}

export function findQRByToken(tokenHash: string): QRToken | undefined {
    return readArray<QRToken>(KEYS.QR_TOKENS).find((t) => t.token === tokenHash);
}

/** Fix 6: Stateful QR Scan Processor — handles progression and locking. */
export async function processQRScan(payload: any): Promise<{
    success: boolean;
    message: string;
    result: "valid" | "duplicate" | "invalid" | "expired"
}> {
    try {
        const { type, hackathonId, userId, token, teamName, timestamp, hash } = payload;

        let result: { success: boolean; message: string; result: "valid" | "duplicate" | "invalid" | "expired" };

        if (type === "registration") {
            // TOTP-like validation (60s rotation)
            const currentTimePeriod = Math.floor(Date.now() / 60000);
            const raw = `${teamName}|${userId}|${hackathonId}|${timestamp}`;
            const expectedHash = await sha256(raw);

            if (hash !== expectedHash.slice(0, 16)) {
                result = { success: false, message: "Invalid Signature", result: "invalid" };
            } else if (Math.abs(currentTimePeriod - timestamp) > 1) {
                // Allow +/- 1 period grace for clock drift or boundary transitions
                result = { success: false, message: "Token Expired", result: "expired" };
            } else {
                const regResult = lockEntryQR(userId, hackathonId);
                if (regResult) result = { success: true, message: "Entry Verified!", result: "valid" };
                else result = { success: false, message: "Already Scanned or Not Found", result: "duplicate" };
            }
        } else {
            // Meal tokens
            const qrToken = findQRByToken(token);
            if (!qrToken) result = { success: false, message: "Invalid Token", result: "invalid" };
            else if (qrToken.used) result = { success: false, message: "Token Already Used", result: "duplicate" };
            else {
                // Progression Check: Reg -> B -> L -> D
                const reg = findRegistration(qrToken.userEmail, qrToken.hackathonId);
                if (!reg?.qrTokenUsed) {
                    result = { success: false, message: "Entry must be scanned first", result: "invalid" };
                } else {
                    const tokens = getQRTokens(qrToken.userEmail, qrToken.hackathonId);
                    if (qrToken.type === "lunch") {
                        const b = tokens.find(t => t.type === "breakfast" && t.day === qrToken.day);
                        if (b && !b.used) result = { success: false, message: "Scan Breakfast first", result: "invalid" };
                        else {
                            markQRUsed(qrToken.id);
                            result = { success: true, message: "LUNCH Verified!", result: "valid" };
                        }
                    } else if (qrToken.type === "dinner") {
                        const l = tokens.find(t => t.type === "lunch" && t.day === qrToken.day);
                        if (l && !l.used) result = { success: false, message: "Scan Lunch first", result: "invalid" };
                        else {
                            markQRUsed(qrToken.id);
                            result = { success: true, message: "DINNER Verified!", result: "valid" };
                        }
                    } else {
                        markQRUsed(qrToken.id);
                        result = { success: true, message: `${qrToken.type.toUpperCase()} Verified!`, result: "valid" };
                    }
                }
            }
        }

        // AUTO-LOG
        const reg = findRegistration(userId || payload.userEmail || "", hackathonId);
        addQRScanLog({
            id: crypto.randomUUID().slice(0, 8),
            hackathonId: hackathonId || "global",
            userEmail: userId || payload.userEmail || "unknown",
            teamName: teamName || reg?.teamName || "unknown",
            tokenType: type,
            tokenHash: token ? (token.slice(0, 8) + "...") : (hash ? (hash + "...") : "manifest"),
            result: result!.result,
            scannedAt: new Date().toISOString(),
        });

        return result!;

    } catch (e) {
        return { success: false, message: "Scan Error", result: "invalid" };
    }
}



/* ================================================================
   NOTIFICATIONS
   ================================================================ */

export function getNotifications(hackathonId?: string): Notification[] {
    const all = readArray<Notification>(KEYS.NOTIFICATIONS);
    if (hackathonId) return all.filter((n) => n.hackathonId === hackathonId);
    return all;
}

export function addNotification(notification: Notification): void {
    const all = readArray<Notification>(KEYS.NOTIFICATIONS);
    all.unshift(notification);
    writeArray(KEYS.NOTIFICATIONS, all);
}

/* ================================================================
   TICKETS (Helpline)
   ================================================================ */

/** Migrate ticket: add hackathonId if missing */
function migrateTicket(t: any): Ticket {
    return {
        id: t.id || crypto.randomUUID().slice(0, 8),
        subject: t.subject || "",
        category: t.category || "Other",
        status: t.status || "Open",
        studentName: t.studentName || "",
        studentEmail: t.studentEmail || "",
        hackathonId: t.hackathonId || "global",  // NEW field migration
        messages: Array.isArray(t.messages) ? t.messages : [],
        createdAt: t.createdAt || new Date().toISOString(),
    };
}

export function getTickets(studentEmail?: string, hackathonId?: string): Ticket[] {
    const all = readArray<any>(KEYS.TICKETS).map(migrateTicket);
    let result = all;
    if (studentEmail) result = result.filter((t) => t.studentEmail === studentEmail);
    if (hackathonId && hackathonId !== "all") result = result.filter((t) => t.hackathonId === hackathonId || t.hackathonId === "global");
    return result;
}

export function createTicket(ticket: Ticket): void {
    const all = readArray<Ticket>(KEYS.TICKETS);
    all.unshift(ticket);
    writeArray(KEYS.TICKETS, all);
}

export function updateTicket(ticketId: string, updates: Partial<Ticket>): void {
    const all = readArray<any>(KEYS.TICKETS).map(migrateTicket);
    const idx = all.findIndex((t) => t.id === ticketId);
    if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        writeArray(KEYS.TICKETS, all);
    }
}

export function addTicketMessage(ticketId: string, msg: TicketMessage): void {
    const all = readArray<any>(KEYS.TICKETS).map(migrateTicket);
    const idx = all.findIndex((t) => t.id === ticketId);
    if (idx !== -1) {
        all[idx].messages.push(msg);
        writeArray(KEYS.TICKETS, all);
    }
}

/* ================================================================
   JUDGE ASSIGNMENTS
   ================================================================ */

export function getJudgeAssignments(judgeEmail?: string, hackathonId?: string): JudgeAssignment[] {
    let all = readArray<JudgeAssignment>(KEYS.JUDGE_ASSIGNMENTS).map((a) => ({
        repoContent: null,
        pptContent: null,
        ...a,
    }));
    if (judgeEmail) all = all.filter((a) => a.judgeEmail === judgeEmail);
    if (hackathonId) all = all.filter((a) => a.hackathonId === hackathonId);
    return all;
}

export function addJudgeAssignment(assignment: JudgeAssignment): void {
    const all = readArray<JudgeAssignment>(KEYS.JUDGE_ASSIGNMENTS);
    all.push({ repoContent: null, pptContent: null, ...assignment });
    writeArray(KEYS.JUDGE_ASSIGNMENTS, all);
}

export function updateJudgeAssignment(
    judgeEmail: string,
    teamId: string,
    updates: Partial<JudgeAssignment>
): void {
    const all = readArray<JudgeAssignment>(KEYS.JUDGE_ASSIGNMENTS);
    const idx = all.findIndex((a) => a.judgeEmail === judgeEmail && a.teamId === teamId);
    if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        writeArray(KEYS.JUDGE_ASSIGNMENTS, all);
    }
}

/* ================================================================
   PROJECT SNAPSHOTS
   ================================================================ */

export function getProjectSnapshot(teamId: string, hackathonId: string): ProjectSnapshot | undefined {
    return readArray<ProjectSnapshot>(KEYS.PROJECT_SNAPSHOTS).find(
        (s) => s.teamId === teamId && s.hackathonId === hackathonId
    );
}

export function saveProjectSnapshot(snapshot: ProjectSnapshot): void {
    const all = readArray<ProjectSnapshot>(KEYS.PROJECT_SNAPSHOTS);
    const idx = all.findIndex(
        (s) => s.teamId === snapshot.teamId && s.hackathonId === snapshot.hackathonId
    );
    if (idx !== -1) { all[idx] = snapshot; } else { all.push(snapshot); }
    writeArray(KEYS.PROJECT_SNAPSHOTS, all);
}

/* ================================================================
   JUDGES (per hackathon) — NEW
   ================================================================ */

export function getJudges(hackathonId: string): Judge[] {
    const all = readObject<Record<string, Judge[]>>(KEYS.JUDGES);
    return all[hackathonId] || [];
}

export function addJudge(hackathonId: string, judge: Judge): void {
    const all = readObject<Record<string, Judge[]>>(KEYS.JUDGES);
    if (!all[hackathonId]) all[hackathonId] = [];
    // Prevent duplicate by email
    const exists = all[hackathonId].find((j) => j.email === judge.email);
    if (!exists) all[hackathonId].push(judge);
    writeObject(KEYS.JUDGES, all);
}

export function removeJudge(hackathonId: string, judgeId: string): void {
    const all = readObject<Record<string, Judge[]>>(KEYS.JUDGES);
    if (all[hackathonId]) {
        all[hackathonId] = all[hackathonId].filter((j) => j.id !== judgeId);
        writeObject(KEYS.JUDGES, all);
    }
}

/* ================================================================
   AI CACHE — NEW
   ================================================================ */

export function getAiCache(submissionId: string): AiEvaluation | undefined {
    return readArray<AiEvaluation>(KEYS.AI_CACHE).find((c) => c.submissionId === submissionId);
}

export function setAiCache(evaluation: AiEvaluation): void {
    const all = readArray<AiEvaluation>(KEYS.AI_CACHE);
    const idx = all.findIndex((c) => c.submissionId === evaluation.submissionId);
    if (idx !== -1) { all[idx] = evaluation; } else { all.push(evaluation); }
    writeArray(KEYS.AI_CACHE, all);
}

/* ================================================================
   EXTERNAL HACKATHONS (Unstop simulation) — NEW
   ================================================================ */

const SEED_EXTERNAL: ExternalHackathon[] = [
    {
        id: "ext_001",
        name: "Smart India Hackathon 2026",
        organizer: "Unstop / Govt of India",
        prizePool: "₹1,00,000",
        deadline: "2026-03-15",
        url: "https://unstop.com/hackathons",
        theme: "GovTech",
    },
    {
        id: "ext_002",
        name: "HackIndia Spring Edition",
        organizer: "Devfolio",
        prizePool: "$5,000",
        deadline: "2026-04-01",
        url: "https://devfolio.co/hackathons",
        theme: "Web3 / AI",
    },
    {
        id: "ext_003",
        name: "ETHIndia 2026",
        organizer: "Devfolio",
        prizePool: "$50,000",
        deadline: "2026-05-10",
        url: "https://ethindia.co",
        theme: "Blockchain",
    },
];

export function getExternalHackathons(): ExternalHackathon[] {
    const existing = readArray<ExternalHackathon>(KEYS.EXTERNAL_HACKATHONS);
    if (existing.length === 0) {
        // Seed on first access
        writeArray(KEYS.EXTERNAL_HACKATHONS, SEED_EXTERNAL);
        return SEED_EXTERNAL;
    }
    return existing;
}

/* ================================================================
   QR SCAN LOGS (Fix 2: Admin monitoring)
   ================================================================ */

export function getQRScanLogs(hackathonId?: string): QRScanLog[] {
    const all = readArray<QRScanLog>(KEYS.QR_SCAN_LOGS);
    if (hackathonId) return all.filter((l) => l.hackathonId === hackathonId);
    return all;
}

export function addQRScanLog(log: QRScanLog): void {
    const all = readArray<QRScanLog>(KEYS.QR_SCAN_LOGS);
    all.unshift(log);
    writeArray(KEYS.QR_SCAN_LOGS, all);
}

/** Simulate a QR scan (for testing/demo). Called from admin monitor. */
export function simulateQRScan(
    hackathonId: string,
    userEmail: string,
    teamName: string,
    tokenType: QRScanLog["tokenType"],
    tokenHash: string
): QRScanLog {
    // Check if token exists
    const token = findQRByToken(tokenHash);
    let result: QRScanLog["result"];

    if (!token) {
        result = "invalid";
    } else if (token.used) {
        result = "duplicate";
    } else {
        result = "valid";
        markQRUsed(token.id);
    }

    const log: QRScanLog = {
        id: crypto.randomUUID().slice(0, 8),
        hackathonId,
        userEmail,
        teamName,
        tokenType,
        tokenHash: tokenHash.slice(0, 12) + "...",
        result,
        scannedAt: new Date().toISOString(),
    };
    addQRScanLog(log);
    return log;
}

/** Admin QR stats summary */
export function getQRStats(hackathonId?: string): {
    totalGenerated: number;
    totalScans: number;
    validScans: number;
    duplicateAttempts: number;
    invalidScans: number;
} {
    const tokens = hackathonId
        ? readArray<QRToken>(KEYS.QR_TOKENS).filter((t) => t.hackathonId === hackathonId)
        : readArray<QRToken>(KEYS.QR_TOKENS);
    const logs = getQRScanLogs(hackathonId);

    return {
        totalGenerated: tokens.length,
        totalScans: logs.length,
        validScans: logs.filter((l) => l.result === "valid").length,
        duplicateAttempts: logs.filter((l) => l.result === "duplicate").length,
        invalidScans: logs.filter((l) => l.result === "invalid" || l.result === "expired").length,
    };
}

/* ================================================================
   RESET SYSTEM (Fix 5: Clear all data except auth)
   ================================================================ */

/** Clear all hackathon data. Does NOT touch auth tokens or user session. */
export function resetSystem(): void {
    // Remove all sq_ keys
    Object.values(KEYS).forEach((key) => {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
    });
    // Remove legacy keys
    try { localStorage.removeItem("global_hackathons"); } catch { /* ignore */ }
    try { localStorage.removeItem("user_registrations"); } catch { /* ignore */ }
    // Remove any active hackathon selections
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sq_active_hackathon_")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
}

/* ================================================================
   GRIEVANCES (Feature 2: Student grievance system)
   ================================================================ */

export function getGrievances(hackathonId?: string, userEmail?: string): Grievance[] {
    const all = readArray<Grievance>(KEYS.GRIEVANCES);
    return all.filter((g) => {
        if (hackathonId && g.hackathonId !== hackathonId) return false;
        if (userEmail && g.userEmail !== userEmail) return false;
        return true;
    });
}

export function createGrievance(grievance: Grievance): void {
    const all = readArray<Grievance>(KEYS.GRIEVANCES);
    all.unshift(grievance);
    writeArray(KEYS.GRIEVANCES, all);
}

export function updateGrievance(id: string, updates: Partial<Grievance>): void {
    const all = readArray<Grievance>(KEYS.GRIEVANCES);
    const idx = all.findIndex((g) => g.id === id);
    if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
        writeArray(KEYS.GRIEVANCES, all);
    }
}

/* ================================================================
   TEAM ELIGIBILITY (Feature 3: dual verification check)
   ================================================================ */

/** Returns true only if ALL members in the registration have verificationStatus === true */
export function isTeamEligible(regId: string): boolean {
    const all = getRegistrations();
    const reg = all.find((r) => r.id === regId);
    if (!reg || !reg.members || reg.members.length === 0) return false;
    return reg.members.every((m) => m.verificationStatus === true);
}

/* ================================================================
   LINKEDIN POSTS (Feature 4: cached generated posts)
   ================================================================ */

export function getLinkedInPost(userEmail: string, hackathonId: string): LinkedInPost | undefined {
    const all = readArray<LinkedInPost>(KEYS.LINKEDIN_POSTS);
    return all.find((p) => p.userEmail === userEmail && p.hackathonId === hackathonId);
}

export function saveLinkedInPost(post: LinkedInPost): void {
    const all = readArray<LinkedInPost>(KEYS.LINKEDIN_POSTS);
    const idx = all.findIndex((p) => p.userEmail === post.userEmail && p.hackathonId === post.hackathonId);
    if (idx !== -1) all[idx] = post; else all.push(post);
    writeArray(KEYS.LINKEDIN_POSTS, all);
}

/* ================================================================
   UTILITY: SHA-256 hash
   ================================================================ */

export async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
