import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Layers,
  FileText,
  Clock,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  MapPin,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";
import { eventsApi, type Stage, type ProblemStatement, type ScheduleState } from "@/services/eventsApi";
import { ApiError } from "@/services/apiClient";

export default function CreateEvent() {
  const navigate = useNavigate();
  const cache = useQueryClient();

  // Basic Details & Dates
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Campus Main Auditorium");
  const [headerImage, setHeaderImage] = useState("");
  const [status, setStatus] = useState<"Open" | "Coming Soon">("Open");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [minTeamSize, setMinTeamSize] = useState(1);
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [rules, setRules] = useState(
    "1. Teams must write original code during the event.\n2. Projects must be submitted on time before evaluation cutoff.\n3. Respect mentors, judges, and fellow participants."
  );

  // Stages & Evaluation Timelines (from DBMS 2)
  const [stages, setStages] = useState<Stage[]>([
    {
      id: "stage-1",
      title: "Round 1 - Ideation & PPT Submission",
      type: "SUBMISSION",
      startDate: "",
      endDate: "",
      description: "Submit project abstract, PPT deck, and GitHub repository draft.",
    },
    {
      id: "stage-2",
      title: "Round 2 - Mid-Way Evaluation & Shortlisting",
      type: "EVALUATION",
      startDate: "",
      endDate: "",
      description: "Judges review prototypes, code commits, and verify progress milestones.",
    },
    {
      id: "stage-3",
      title: "Round 3 - Final Demo & Presentation",
      type: "FINAL",
      startDate: "",
      endDate: "",
      description: "Shortlisted teams present working prototypes to the judging panel.",
    },
  ]);

  // Problem Statements / Tracks (from DBMS 2)
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([
    {
      id: "ps-1",
      title: "Smart Campus & Student Operations",
      description: "Build innovative automated solutions for campus events, attendance, or student life.",
    },
  ]);

  // Final Round Checkpoint Schedules (from DBMS 2)
  const [schedules, setSchedules] = useState<ScheduleState>({
    entry: { startTime: "", endTime: "" },
    breakfast: { startTime: "", endTime: "" },
    lunch: { startTime: "", endTime: "" },
    dinner: { startTime: "", endTime: "" },
  });

  const [enabledSchedules, setEnabledSchedules] = useState({
    entry: true,
    breakfast: false,
    lunch: false,
    dinner: false,
  });

  // Stage Handlers
  const addStage = () => {
    const nextIndex = stages.length + 1;
    setStages([
      ...stages,
      {
        id: `stage-${Date.now()}`,
        title: `Round ${nextIndex} - Milestone Evaluation`,
        type: "EVALUATION",
        startDate: "",
        endDate: "",
        description: "Milestone check-in and review.",
      },
    ]);
  };

  const removeStage = (id: string) => {
    if (stages.length <= 1) return;
    setStages(stages.filter((s) => s.id !== id));
  };

  const updateStage = (id: string, field: keyof Stage, value: string) => {
    setStages(stages.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Problem Statement Handlers
  const addProblemStatement = () => {
    const nextIndex = problemStatements.length + 1;
    setProblemStatements([
      ...problemStatements,
      {
        id: `ps-${Date.now()}`,
        title: `Track ${nextIndex} - Open Innovation`,
        description: "Define custom challenges and problem statements for participants.",
      },
    ]);
  };

  const removeProblemStatement = (id: string) => {
    if (problemStatements.length <= 1) return;
    setProblemStatements(problemStatements.filter((p) => p.id !== id));
  };

  const updateProblemStatement = (
    id: string,
    field: "title" | "description",
    value: string
  ) => {
    setProblemStatements(
      problemStatements.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Schedule Handlers
  const updateScheduleTime = (
    type: keyof ScheduleState,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setSchedules((prev) => ({
      ...prev,
      [type]: {
        startTime: prev[type]?.startTime || "",
        endTime: prev[type]?.endTime || "",
        [field]: value,
      },
    }));
  };

  const toggleSchedule = (type: "breakfast" | "lunch" | "dinner") => {
    setEnabledSchedules((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // Mutation
  const create = useMutation({
    mutationFn: eventsApi.create,
    onSuccess: (event) => {
      cache.invalidateQueries({ queryKey: ["events"] });
      navigate(`/events/${event.id}`);
    },
  });

  const fieldErrors =
    (create.error instanceof ApiError ? create.error.fields : undefined) || {};
  const hasError = (field: string) => !!fieldErrors[field]?.length;
  const errorMsg = (field: string) => fieldErrors[field]?.[0];
  const inputClass = (field: string) =>
    `mt-2 w-full rounded-xl border bg-card/80 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${
      hasError(field) ? "border-destructive ring-1 ring-destructive" : ""
    }`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare active schedules payload
    const activeSchedules: ScheduleState = {};
    if (enabledSchedules.entry && schedules.entry?.startTime) {
      activeSchedules.entry = schedules.entry;
    }
    if (enabledSchedules.breakfast && schedules.breakfast?.startTime) {
      activeSchedules.breakfast = schedules.breakfast;
    }
    if (enabledSchedules.lunch && schedules.lunch?.startTime) {
      activeSchedules.lunch = schedules.lunch;
    }
    if (enabledSchedules.dinner && schedules.dinner?.startTime) {
      activeSchedules.dinner = schedules.dinner;
    }

    create.mutate({
      name,
      theme,
      description,
      location,
      headerImage,
      rules,
      startDate,
      endDate,
      registrationDeadline,
      minTeamSize: Number(minTeamSize),
      maxTeamSize: Number(maxTeamSize),
      status,
      stages,
      problemStatements,
      schedules: activeSchedules,
    });
  };

  return (
    <main className="container max-w-4xl px-4 pb-20 pt-28">
      <Link to="/hackathons" className="text-sm font-semibold text-primary hover:underline">
        ← Back to hackathons
      </Link>

      <div className="mt-4 mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
          <Sparkles className="size-3.5" />
          <span>Hackathon Architect</span>
        </div>
        <h1 className="text-3xl font-extrabold sm:text-4xl tracking-tight">
          Create New Hackathon
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Configure basic details, multi-stage evaluation timelines, problem tracks, and round schedules.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: BASIC DETAILS */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b pb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <FileText className="size-5 text-primary" />
              1. Basic Details
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Title, theme, banner and public information for participants.
            </p>
          </div>

          <label className="block text-sm font-medium">
            Event Name <span className="text-destructive">*</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HackMatrix 2026"
              required
              minLength={3}
              maxLength={150}
              className={inputClass("name")}
            />
            {hasError("name") && (
              <p className="mt-1 text-xs text-destructive">{errorMsg("name")}</p>
            )}
          </label>

          <label className="block text-sm font-medium">
            Theme / Category
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. AI & Web3 Autonomous Systems"
              maxLength={300}
              className={inputClass("theme")}
            />
            {hasError("theme") && (
              <p className="mt-1 text-xs text-destructive">{errorMsg("theme")}</p>
            )}
          </label>

          <label className="block text-sm font-medium">
            Description <span className="text-destructive">*</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the challenge, goals, expected outcomes, and target audience..."
              required
              rows={4}
              maxLength={5000}
              className={inputClass("description")}
            />
            {hasError("description") && (
              <p className="mt-1 text-xs text-destructive">
                {errorMsg("description")}
              </p>
            )}
          </label>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="size-4 text-muted-foreground" />
                <span>Venue / Location</span>
              </div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Campus Main Auditorium or Online"
                className={inputClass("location")}
              />
            </label>

            <label className="block text-sm font-medium">
              <div className="flex items-center gap-1.5 mb-1">
                <ImageIcon className="size-4 text-muted-foreground" />
                <span>Header Image Banner URL (Optional)</span>
              </div>
              <input
                value={headerImage}
                onChange={(e) => setHeaderImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                type="url"
                className={inputClass("headerImage")}
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Initial Registration Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "Open" | "Coming Soon")}
              className={inputClass("status")}
            >
              <option value="Open">Open (Students can register immediately)</option>
              <option value="Coming Soon">Coming Soon (Announced, registrations pending)</option>
            </select>
          </label>
        </div>

        {/* SECTION 2: DATES & TEAM CONSTRAINTS */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b pb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Calendar className="size-5 text-primary" />
              2. Dates & Team Size
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Specify when the hackathon starts, ends, and registration closes.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Start Date <span className="text-destructive">*</span>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`mt-2 w-full rounded-xl border bg-card/80 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  hasError("startDate") ? "border-destructive ring-1 ring-destructive" : ""
                }`}
              />
              {hasError("startDate") && (
                <p className="mt-1 text-xs text-destructive">{errorMsg("startDate")}</p>
              )}
            </label>

            <label className="block text-sm font-medium">
              End Date <span className="text-destructive">*</span>
              <input
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`mt-2 w-full rounded-xl border bg-card/80 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  hasError("endDate") ? "border-destructive ring-1 ring-destructive" : ""
                }`}
              />
              {hasError("endDate") && (
                <p className="mt-1 text-xs text-destructive">{errorMsg("endDate")}</p>
              )}
            </label>

            <label className="block text-sm font-medium">
              Registration Deadline <span className="text-destructive">*</span>
              <input
                type="date"
                required
                max={endDate || undefined}
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className={`mt-2 w-full rounded-xl border bg-card/80 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  hasError("registrationDeadline")
                    ? "border-destructive ring-1 ring-destructive"
                    : ""
                }`}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Must be on or before the event end date.
              </p>
              {hasError("registrationDeadline") && (
                <p className="mt-1 text-xs text-destructive">
                  {errorMsg("registrationDeadline")}
                </p>
              )}
            </label>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="size-4 text-muted-foreground" />
                <span>Minimum Team Size</span>
              </div>
              <input
                type="number"
                min={1}
                max={50}
                value={minTeamSize}
                onChange={(e) => setMinTeamSize(Number(e.target.value))}
                required
                className={inputClass("minTeamSize")}
              />
              {hasError("minTeamSize") && (
                <p className="mt-1 text-xs text-destructive">
                  {errorMsg("minTeamSize")}
                </p>
              )}
            </label>

            <label className="block text-sm font-medium">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="size-4 text-muted-foreground" />
                <span>Maximum Team Size</span>
              </div>
              <input
                type="number"
                min={minTeamSize}
                max={50}
                value={maxTeamSize}
                onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                required
                className={inputClass("maxTeamSize")}
              />
              {hasError("maxTeamSize") && (
                <p className="mt-1 text-xs text-destructive">
                  {errorMsg("maxTeamSize")}
                </p>
              )}
            </label>
          </div>
        </div>

        {/* SECTION 3: STAGES & EVALUATION TIMELINES (From DBMS 2) */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Layers className="size-5 text-primary" />
                3. Stages & Evaluation Timelines
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Define the progression stages, submission windows, and evaluation deadlines.
              </p>
            </div>
            <button
              type="button"
              onClick={addStage}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="size-3.5" />
              Add Stage
            </button>
          </div>

          <div className="space-y-4">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="relative rounded-xl border bg-muted/20 p-5 space-y-4 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary font-mono">
                    STAGE 0{index + 1}
                  </span>
                  {stages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStage(stage.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remove Stage"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Stage Title
                      <input
                        value={stage.title}
                        onChange={(e) => updateStage(stage.id, "title", e.target.value)}
                        placeholder="e.g. Round 1 - Ideation & Prototype"
                        required
                        className="mt-1 w-full rounded-lg border bg-card p-2.5 text-sm"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Stage Type
                      <select
                        value={stage.type}
                        onChange={(e) =>
                          updateStage(stage.id, "type", e.target.value as Stage["type"])
                        }
                        className="mt-1 w-full rounded-lg border bg-card p-2.5 text-sm"
                      >
                        <option value="SUBMISSION">SUBMISSION (Upload code/PPT)</option>
                        <option value="EVALUATION">EVALUATION (Judges scoring)</option>
                        <option value="FINAL">FINAL (Live presentation & demo)</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Start Date & Time (Optional)
                    <input
                      type="datetime-local"
                      value={stage.startDate}
                      onChange={(e) => updateStage(stage.id, "startDate", e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-card p-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-medium text-muted-foreground">
                    End Date & Time / Deadline
                    <input
                      type="datetime-local"
                      value={stage.endDate}
                      onChange={(e) => updateStage(stage.id, "endDate", e.target.value)}
                      className="mt-1 w-full rounded-lg border bg-card p-2.5 text-sm"
                    />
                  </label>
                </div>

                <label className="block text-xs font-medium text-muted-foreground">
                  Deliverables & Description
                  <textarea
                    rows={2}
                    value={stage.description}
                    onChange={(e) => updateStage(stage.id, "description", e.target.value)}
                    placeholder="What should participants submit or prepare for this stage?"
                    className="mt-1 w-full rounded-lg border bg-card p-2.5 text-sm"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: PROBLEM STATEMENTS / TRACKS (From DBMS 2) */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="size-5 text-primary" />
                4. Problem Statements & Tracks
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Provide problem tracks or challenges for teams to choose from.
              </p>
            </div>
            <button
              type="button"
              onClick={addProblemStatement}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="size-3.5" />
              Add Track
            </button>
          </div>

          <div className="space-y-4">
            {problemStatements.map((statement, index) => (
              <div
                key={statement.id}
                className="relative rounded-xl border bg-muted/20 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-accent-foreground font-mono">
                    TRACK 0{index + 1}
                  </span>
                  {problemStatements.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProblemStatement(statement.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remove Track"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <label className="block text-xs font-medium text-muted-foreground">
                  Track / Statement Title
                  <input
                    value={statement.title}
                    onChange={(e) =>
                      updateProblemStatement(statement.id, "title", e.target.value)
                    }
                    placeholder="e.g. AI-Driven Smart Traffic Routing"
                    required
                    className="mt-1 w-full rounded-lg border bg-card p-2.5 text-sm"
                  />
                </label>

                <label className="block text-xs font-medium text-muted-foreground">
                  Description / Specific Goals
                  <textarea
                    rows={2}
                    value={statement.description}
                    onChange={(e) =>
                      updateProblemStatement(statement.id, "description", e.target.value)
                    }
                    placeholder="Describe problem context, constraints, and success criteria..."
                    className="mt-1 w-full rounded-lg border bg-card p-2.5 text-sm"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5: FINAL ROUND CHECKPOINT SCHEDULES (From DBMS 2) */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b pb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Clock className="size-5 text-primary" />
              5. Final Round Checkpoints & QR Schedule
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Configure attendance and meal check-in windows used for QR pass verification.
            </p>
          </div>

          <div className="space-y-4">
            {(
              [
                { key: "entry", label: "Entry & Check-in", req: true },
                { key: "breakfast", label: "Breakfast Checkpoint", req: false },
                { key: "lunch", label: "Lunch Checkpoint", req: false },
                { key: "dinner", label: "Dinner Checkpoint", req: false },
              ] as const
            ).map((item) => {
              const isRequired = item.req;
              const isEnabled = isRequired || enabledSchedules[item.key];
              const config = schedules[item.key];

              return (
                <div
                  key={item.key}
                  className={`rounded-xl border p-4 transition-all ${
                    isEnabled ? "bg-card/90 border-border" : "bg-muted/10 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{item.label}</span>
                      {isRequired && (
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          REQUIRED
                        </span>
                      )}
                    </div>

                    {!isRequired && (
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => toggleSchedule(item.key)}
                          className="rounded accent-primary"
                        />
                        <span>Enable</span>
                      </label>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Start Time
                      <input
                        type="time"
                        value={config?.startTime || ""}
                        disabled={!isEnabled}
                        onChange={(e) =>
                          updateScheduleTime(item.key, "startTime", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border bg-card p-2 text-sm disabled:opacity-50"
                      />
                    </label>

                    <label className="block text-xs font-medium text-muted-foreground">
                      End Time
                      <input
                        type="time"
                        value={config?.endTime || ""}
                        disabled={!isEnabled}
                        onChange={(e) =>
                          updateScheduleTime(item.key, "endTime", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border bg-card p-2 text-sm disabled:opacity-50"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 6: RULES & GUIDELINES */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b pb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CheckCircle2 className="size-5 text-primary" />
              6. Rules & Conduct
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Guidelines, judging criteria, and submission rules for the participants.
            </p>
          </div>

          <label className="block text-sm font-medium">
            Rules & Code of Conduct
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={5}
              maxLength={10000}
              className={inputClass("rules")}
            />
            {hasError("rules") && (
              <p className="mt-1 text-xs text-destructive">{errorMsg("rules")}</p>
            )}
          </label>
        </div>

        {/* Error notification if mutation failed */}
        {create.isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{create.error.message}</p>
              {Object.keys(fieldErrors).length > 0 && (
                <ul className="mt-2 list-disc list-inside text-xs space-y-1">
                  {Object.entries(fieldErrors).map(([key, errs]) => (
                    <li key={key}>
                      <span className="font-semibold capitalize">{key}</span>:{" "}
                      {errs?.join(", ")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4">
          <Link
            to="/hackathons"
            className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-muted transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={create.isPending}
            className="btn-primary-glow inline-flex items-center gap-2 px-8 py-3 text-sm font-bold shadow-lg disabled:opacity-50"
          >
            {create.isPending ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Publishing Hackathon…</span>
              </>
            ) : (
              <>
                <Plus className="size-4" />
                <span>Create & Publish Hackathon</span>
              </>
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
