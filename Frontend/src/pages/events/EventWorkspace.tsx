import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import {
  CalendarDays,
  Clock,
  Layers,
  MapPin,
  Sparkles,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  FileText,
  Gavel,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import {
  eventsApi,
  parseEventStages,
  parseEventProblemStatements,
  parseEventSchedules,
  type EventRecord,
  type Member,
  type Stage,
  type ProblemStatement,
  type ScheduleState,
} from "@/services/eventsApi";
import SubmissionList from "./SubmissionList";
import EventActivity from "./EventActivity";

const field = "mt-2 w-full rounded-xl border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

function StagesRoadmap({ stages }: { stages: Stage[] }) {
  if (!stages || stages.length === 0) return null;

  return (
    <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Layers className="size-5 text-primary" />
            Hackathon Stages & Evaluation Timelines
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Track milestones, deliverables, evaluation windows, and presentation rounds.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary font-mono">
          {stages.length} Stage{stages.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:bottom-2 before:left-[11px] sm:before:left-[15px] before:top-2 before:w-[2px] before:bg-border">
        {stages.map((stage, index) => {
          const typeBadge =
            stage.type === "SUBMISSION"
              ? { label: "Submission Round", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: FileText }
              : stage.type === "EVALUATION"
              ? { label: "Judge Evaluation", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Gavel }
              : { label: "Final Demo & Pitch", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: Trophy };

          const IconComponent = typeBadge.icon;

          return (
            <div key={stage.id} className="relative group">
              {/* Timeline marker */}
              <div className="absolute -left-[31px] sm:-left-[35px] top-1.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                {index + 1}
              </div>

              <div className="rounded-xl border bg-card/60 p-5 space-y-3 shadow-sm hover:border-primary/40 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Stage 0{index + 1}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${typeBadge.color}`}
                  >
                    <IconComponent className="size-3" />
                    {typeBadge.label}
                  </span>
                </div>

                <h3 className="text-base font-bold text-foreground">
                  {stage.title}
                </h3>

                {stage.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {stage.description}
                  </p>
                )}

                {(stage.startDate || stage.endDate) && (
                  <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground border-t">
                    {stage.startDate && (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5 text-primary" />
                        <span>
                          Starts: {new Date(stage.startDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>
                    )}
                    {stage.endDate && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-amber-500" />
                        <span>
                          Deadline: <strong>{new Date(stage.endDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProblemStatementsSection({ problemStatements }: { problemStatements: ProblemStatement[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!problemStatements || problemStatements.length === 0) return null;

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="size-5 text-primary" />
            Problem Statements & Challenge Tracks
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a challenge track for your project submission.
          </p>
        </div>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent-foreground font-mono">
          {problemStatements.length} Track{problemStatements.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-3">
        {problemStatements.map((ps, index) => {
          const isOpen = !!expanded[ps.id];

          return (
            <div key={ps.id} className="rounded-xl border bg-card/60 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => toggle(ps.id)}
                className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold font-mono text-primary">
                    0{index + 1}
                  </span>
                  <span className="font-semibold text-sm sm:text-base">{ps.title}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium shrink-0">
                  <span>{isOpen ? "Hide" : "Details"}</span>
                  {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
              </button>

              {isOpen && ps.description && (
                <div className="border-t bg-muted/20 p-4 text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {ps.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CheckpointsSection({ schedules }: { schedules: ScheduleState }) {
  const activeEntries = Object.entries(schedules).filter(
    ([, config]) => config && (config.startTime || config.endTime)
  );

  if (activeEntries.length === 0) return null;

  const labels: Record<string, string> = {
    entry: "Venue Entry & Security Pass",
    breakfast: "Morning Breakfast Checkpoint",
    lunch: "Lunch & Networking Window",
    dinner: "Evening Dinner Checkpoint",
  };

  return (
    <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
      <div className="border-b pb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Clock className="size-5 text-primary" />
          Final Round Checkpoint Schedules
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          QR pass verification windows for attendance, catering, and venue access.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {activeEntries.map(([key, config]) => (
          <div key={key} className="rounded-xl border bg-card/60 p-4 space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-primary font-bold">
              {key} checkpoint
            </span>
            <p className="font-semibold text-sm">{labels[key] || key}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Clock className="size-3.5" />
              <span>
                {config?.startTime || "--:--"} → {config?.endTime || "--:--"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StudentWorkspace({ event }: { event: EventRecord }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const key = ["event", event.id, user?.id];

  const team = useQuery({
    queryKey: [...key, "team"],
    queryFn: async () => {
      try {
        return await eventsApi.myTeam(event.id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

  const submissions = useQuery({
    queryKey: [...key, "submissions"],
    queryFn: () => eventsApi.submissions(event.id, false),
    enabled: !!team.data,
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [kind, setKind] = useState("github");
  const [purpose, setPurpose] = useState("entry");

  const register = useMutation({
    mutationFn: (name: string) => eventsApi.register(event.id, name, members),
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
  });

  const submit = useMutation({
    mutationFn: async (data: FormData) => {
      const file = data.get("file") as File | null;
      const name = String(data.get("name"));
      const url = String(data.get("url") || "");
      if (kind === "github") return eventsApi.submit(event.id, kind, { name, url });
      if (file?.size) {
        if (url) throw new Error("Choose either a PDF or a link, not both.");
        if (file.size > 10 * 1024 * 1024) throw new Error("PDF must be no larger than 10 MB.");
        const uploaded = await eventsApi.upload(file);
        return eventsApi.submit(event.id, kind, { name, fileId: uploaded.id });
      }
      return eventsApi.submit(event.id, kind, { name, link: url });
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: [...key, "submissions"] }),
  });

  const issue = useMutation({
    mutationFn: (day: number) => eventsApi.issuePass(event.id, purpose, day),
  });

  if (team.isPending) return <p role="status">Loading your team…</p>;
  if (team.isError) return <p role="alert">{team.error.message}</p>;

  if (!team.data) {
    const isPastDeadline = event.registrationDeadline < new Date().toISOString().slice(0, 10);
    const isClosed = event.status !== "Open" || isPastDeadline;

    return (
      <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold">Team Registration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isClosed
              ? "Registration for this event is currently closed."
              : `You will be the team leader. Invite ${event.minTeamSize - 1}–${event.maxTeamSize - 1} teammates to join.`}
          </p>
        </div>

        {isClosed ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            Registration has ended for this event.
          </div>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              register.mutate(String(new FormData(e.currentTarget).get("teamName")));
            }}
          >
            <label className="block text-sm font-medium">
              Team Name <span className="text-destructive">*</span>
              <input
                className={field}
                name="teamName"
                placeholder="e.g. Neural Pioneers"
                required
                minLength={2}
                maxLength={150}
              />
            </label>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Teammates ({members.length} added)
                </span>
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  disabled={members.length >= event.maxTeamSize - 1}
                  onClick={() => setMembers((rows) => [...rows, { name: "", email: "" }])}
                >
                  + Add Teammate
                </button>
              </div>

              {members.map((member, index) => (
                <fieldset key={index} className="rounded-xl border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Teammate 0{index + 1}
                    </legend>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => setMembers((rows) => rows.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-medium">
                      Full Name
                      <input
                        required
                        className={field}
                        value={member.name}
                        onChange={(e) =>
                          setMembers((rows) =>
                            rows.map((row, i) => (i === index ? { ...row, name: e.target.value } : row))
                          )
                        }
                      />
                    </label>

                    <label className="text-xs font-medium">
                      Email Address
                      <input
                        type="email"
                        required
                        className={field}
                        value={member.email}
                        onChange={(e) =>
                          setMembers((rows) =>
                            rows.map((row, i) => (i === index ? { ...row, email: e.target.value } : row))
                          )
                        }
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </div>

            <button
              type="submit"
              className="btn-primary-glow w-full sm:w-auto font-bold disabled:opacity-50"
              disabled={register.isPending || members.length < event.minTeamSize - 1}
            >
              {register.isPending ? "Registering Team…" : "Confirm Team Registration"}
            </button>

            {register.isError && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {register.error.message}
              </p>
            )}
          </form>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {/* Team Info Card */}
      <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
              Registered Team
            </span>
            <h2 className="text-2xl font-bold">{team.data.teamName}</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="size-3.5" />
            Registered
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Team Members
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {team.data.members.map((member) => (
              <li
                key={member.email}
                className="rounded-xl border bg-card/60 p-3 text-sm flex flex-col"
              >
                <span className="font-semibold">{member.name}</span>
                <span className="text-xs text-muted-foreground">{member.email}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Submissions Section */}
      <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold">Project Deliverables & Submission</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Submit your GitHub repository, architecture slides, or project PDF.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate(new FormData(e.currentTarget));
          }}
        >
          <label className="block text-xs font-medium">
            Submission Type
            <select
              className={field}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                submit.reset();
              }}
            >
              <option value="github">GitHub Repository</option>
              <option value="presentation">Presentation Deck / Document</option>
            </select>
          </label>

          <label className="block text-xs font-medium">
            Project / Deliverable Title
            <input className={field} name="name" required maxLength={150} placeholder="e.g. CampusBot MVP" />
          </label>

          <label className="block text-xs font-medium">
            {kind === "github" ? "GitHub URL" : "Presentation URL (HTTPS)"}
            <input
              className={field}
              name="url"
              type="url"
              required={kind === "github"}
              placeholder={kind === "github" ? "https://github.com/team/project" : "https://docs.google.com/presentation/..."}
            />
          </label>

          {kind === "presentation" && (
            <label className="block text-xs font-medium">
              Or Upload PDF Slides (up to 10 MB)
              <input className={field} name="file" type="file" accept="application/pdf,.pdf" />
            </label>
          )}

          <button
            type="submit"
            className="btn-primary-glow font-bold disabled:opacity-50"
            disabled={submit.isPending}
          >
            {submit.isPending ? "Uploading…" : "Save Submission"}
          </button>

          {submit.isError && <p role="alert" className="text-xs text-destructive">{submit.error.message}</p>}
          {submit.isSuccess && <p role="status" className="text-xs text-emerald-600 font-semibold">Submission saved successfully.</p>}
        </form>

        {submissions.isError && <p role="alert" className="text-xs text-destructive">{submissions.error.message}</p>}
        <SubmissionList submissions={submissions.data || []} />
      </section>

      {/* QR Check-in Pass Card */}
      <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold">Event QR Check-in Pass</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate your dynamic QR token for entrance, meals, and checkpoint verification.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            issue.mutate(purpose === "entry" ? 0 : Number(new FormData(e.currentTarget).get("day")));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium">
              Checkpoint Purpose
              <select
                className={field}
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  issue.reset();
                }}
              >
                {["entry", "breakfast", "lunch", "dinner"].map((value) => (
                  <option key={value} value={value}>
                    {value.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            {purpose !== "entry" && (
              <label className="block text-xs font-medium">
                Event Day
                <input className={field} name="day" type="number" min={1} max={14} defaultValue={1} required />
              </label>
            )}
          </div>

          <button className="btn-primary-glow font-bold" disabled={issue.isPending}>
            {issue.isPending ? "Generating…" : "Generate Check-in QR"}
          </button>
        </form>

        {issue.isError && <p role="alert" className="text-xs text-destructive">{issue.error.message}</p>}

        {issue.data && (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border bg-card/80 p-6 text-center space-y-4">
            <div className="rounded-xl bg-white p-4 shadow-sm" aria-label="Check-in QR code">
              <QRCode value={issue.data.token} size={180} style={{ maxWidth: "100%", height: "auto" }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Valid until: {new Date(issue.data.expiresAt).toLocaleString()}
            </p>
            <div className="w-full max-w-sm">
              <label className="block text-xs font-mono text-muted-foreground mb-1">Pass Token Code</label>
              <input readOnly className="w-full rounded-lg border bg-muted/30 p-2 text-center font-mono text-xs" value={issue.data.token} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OrganizerWorkspace({ event }: { event: EventRecord }) {
  const cache = useQueryClient();
  const key = ["event", event.id, "organizer"];
  const teams = useQuery({ queryKey: [...key, "teams"], queryFn: () => eventsApi.teams(event.id), refetchInterval: 10000 });
  const submissions = useQuery({ queryKey: [...key, "submissions"], queryFn: () => eventsApi.submissions(event.id, true), refetchInterval: 10000 });
  const logs = useQuery({ queryKey: [...key, "checkins"], queryFn: () => eventsApi.checkins(event.id) });
  const redeem = useMutation({ mutationFn: eventsApi.redeem, onSuccess: () => cache.invalidateQueries({ queryKey: [...key, "checkins"] }) });

  return (
    <div className="space-y-8">
      <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold">Registered Teams & Submissions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live overview of all participating teams, member rosters, and submitted code.
          </p>
        </div>

        {(teams.isPending || submissions.isPending) && <p role="status">Loading teams and submissions…</p>}
        {(teams.isError || submissions.isError) && <p role="alert">{teams.error?.message || submissions.error?.message}</p>}
        {teams.data?.length === 0 && <p className="text-sm text-muted-foreground">No teams registered yet.</p>}

        <div className="space-y-4">
          {teams.data?.map((team) => (
            <article className="rounded-xl border bg-card/60 p-5 space-y-3 shadow-sm" key={team.id}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">{team.teamName}</h3>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {team.members.length} Members
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {team.members.map((member) => member.name).join(", ")}
              </p>
              <SubmissionList
                submissions={submissions.data?.filter((item) => item.registrationId === team.id) || []}
              />
            </article>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold">Pass Verification Scanner</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Scan or paste QR pass tokens to log attendance and checkpoint compliance.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            redeem.mutate(String(new FormData(e.currentTarget).get("token")).trim());
          }}
        >
          <label className="block text-xs font-medium">
            Check-in Token
            <input className={field} name="token" required autoComplete="off" placeholder="Scan or enter code..." />
          </label>
          <button className="btn-primary-glow font-bold" disabled={redeem.isPending}>
            {redeem.isPending ? "Verifying…" : "Verify Pass"}
          </button>
        </form>

        {redeem.isError && <p role="alert" className="text-xs text-destructive">{redeem.error.message}</p>}
        {redeem.data && (
          <p role="status" className={`text-xs font-bold ${redeem.data.result === "valid" ? "text-emerald-600" : "text-destructive"}`}>
            {redeem.data.message}
          </p>
        )}

        {logs.data && logs.data.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Check-in Logs</h4>
            <ul className="space-y-1.5 text-xs font-mono">
              {logs.data.slice(0, 10).map((log) => (
                <li key={log.id} className="flex justify-between border-b pb-1 text-muted-foreground">
                  <span>{log.purpose.toUpperCase()}</span>
                  <span className={log.result === "valid" ? "text-emerald-500 font-bold" : "text-destructive font-bold"}>
                    {log.result}
                  </span>
                  <span>{new Date(log.scannedAt).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

export default function EventWorkspace() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const event = useQuery({ queryKey: ["events", id], queryFn: () => eventsApi.get(id) });

  const stages = parseEventStages(event.data?.stages);
  const problemStatements = parseEventProblemStatements(event.data?.problemStatements);
  const schedules = parseEventSchedules(event.data?.schedules);

  return (
    <main className="container max-w-4xl px-4 pb-20 pt-28">
      <Link to="/hackathons" className="text-sm font-semibold text-primary hover:underline">
        ← All Hackathons
      </Link>

      {event.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <p className="text-sm text-muted-foreground">Loading hackathon workspace…</p>
        </div>
      )}

      {event.isError && (
        <div role="alert" className="glass-card mt-8 p-8 text-center text-destructive">
          <AlertCircle className="size-8 mx-auto mb-2" />
          <p className="font-semibold">{event.error.message}</p>
        </div>
      )}

      {event.data && (
        <div className="mt-6 space-y-8">
          {/* Hero Banner Section */}
          <header className="glass-card overflow-hidden rounded-2xl">
            {event.data.headerImage ? (
              <div className="h-52 w-full overflow-hidden">
                <img
                  src={event.data.headerImage}
                  alt={event.data.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
                  {event.data.theme || "Hackathon"}
                </span>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                  {event.data.status}
                </span>
                {event.data.location && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 text-primary" />
                    {event.data.location}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-extrabold sm:text-4xl">{event.data.name}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {event.data.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 border-t pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  <span>
                    {event.data.startDate} → {event.data.endDate}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-500" />
                  <span>
                    Registration Deadline: <strong>{event.data.registrationDeadline}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <span>
                    {event.data.minTeamSize}–{event.data.maxTeamSize} people per team
                  </span>
                </div>
              </div>

              {event.data.rules && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-primary hover:underline">
                    View Rules & Guidelines
                  </summary>
                  <div className="mt-3 rounded-xl border bg-muted/20 p-4 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                    {event.data.rules}
                  </div>
                </details>
              )}
            </div>
          </header>

          {/* Interactive Stages & Evaluation Timelines Roadmap */}
          <StagesRoadmap stages={stages} />

          {/* Problem Statements / Tracks */}
          <ProblemStatementsSection problemStatements={problemStatements} />

          {/* Final Round Checkpoint Schedules */}
          <CheckpointsSection schedules={schedules} />

          {/* Action Call for Non-signed-in users */}
          {!user && (
            <div className="glass-card rounded-2xl p-8 text-center space-y-3">
              <h3 className="text-lg font-bold">Ready to participate?</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Sign in with your student account to register your team, submit project artifacts, and generate check-in passes.
              </p>
              <Link to="/auth/login?role=student" className="btn-primary-glow inline-block font-bold">
                Sign in as Student to Register
              </Link>
            </div>
          )}

          {/* Student or Organizer Workspace */}
          {user?.role === "student" && <StudentWorkspace key={`${id}-${user.id}`} event={event.data} />}
          {user?.role === "admin" && event.data.ownerId === user.id && (
            <OrganizerWorkspace key={id} event={event.data} />
          )}

          <EventActivity key={event.data.id} event={event.data} />
        </div>
      )}
    </main>
  );
}
