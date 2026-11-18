import { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ArrowUpRight,
  Plus,
  Users,
  Search,
  MapPin,
  Layers,
  Sparkles,
  Camera,
  X,
  Clock,
  ImageIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  eventsApi,
  parseEventStages,
  resolveBannerUrl,
  type EventRecord,
} from "@/services/eventsApi";

function PageGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-[-100px] h-[520px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/15 via-accent/10 to-transparent blur-3xl" />
      <div className="absolute right-[-100px] top-[240px] h-[400px] w-[400px] rounded-full bg-gradient-to-br from-accent/15 via-primary/10 to-transparent blur-3xl" />
      <div className="absolute bottom-[-150px] left-[-100px] h-[450px] w-[450px] rounded-full bg-gradient-to-br from-primary/10 via-accent/10 to-transparent blur-3xl" />
    </div>
  );
}

// High-contrast, solid dark frosted badge that will NEVER merge into any background image or gradient
function StatusBadge({ status }: { status: EventRecord["status"] }) {
  if (status === "Open") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950/95 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/50 backdrop-blur-md shadow-lg shadow-black/60 ring-1 ring-emerald-500/20">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
        Open for Registration
      </span>
    );
  }
  if (status === "Ongoing") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950/95 px-3 py-1 text-xs font-bold text-sky-400 border border-sky-500/50 backdrop-blur-md shadow-lg shadow-black/60 ring-1 ring-sky-500/20">
        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
        Ongoing
      </span>
    );
  }
  if (status === "Coming Soon") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950/95 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/50 backdrop-blur-md shadow-lg shadow-black/60 ring-1 ring-amber-500/20">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Coming Soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950/95 px-3 py-1 text-xs font-bold text-zinc-300 border border-zinc-700 backdrop-blur-md shadow-lg shadow-black/60">
      Completed
    </span>
  );
}

export default function EventsPage() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const destinations: Record<string, [string, string]> = {
    "/leaderboard": ["Event results", "results"],
    "/student/notifications": ["Event announcements", "announcements"],
    "/student/grievance": ["Event support", "support"],
    "/helpline": ["Event support", "support"],
  };
  const destination = destinations[pathname];

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  const events = useQuery({ queryKey: ["events"], queryFn: eventsApi.list });

  const filtered = useMemo(() => {
    return events.data?.filter((event) => {
      const matchesSearch =
        `${event.name} ${event.theme} ${event.description} ${event.location || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus =
        selectedStatus === "All" || event.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [events.data, search, selectedStatus]);

  const statusOptions = ["All", "Open", "Coming Soon", "Ongoing", "Completed"];

  return (
    <main className="relative min-h-screen container max-w-6xl px-4 pb-20 pt-28">
      <PageGlow />

      {/* Header section */}
      <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3.5" />
            <span>Hackathons & Challenges</span>
          </div>

          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {destination?.[0] || "Explore Hackathons"}
          </h1>

          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {destination
              ? "Choose an event to continue to your workspace."
              : "Discover competitions, register your team with multi-stage evaluation timelines, and build projects that make an impact."}
          </p>

          {user?.role === "student" && (
            <div className="mt-4">
              <Link
                to="/student/verify"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Camera className="size-4" />
                Manage biometric face profile for seamless check-in →
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden rounded-2xl border bg-card/60 px-4 py-2.5 text-xs font-semibold text-muted-foreground backdrop-blur-md sm:block">
            {filtered?.length ?? 0} hackathon{filtered?.length === 1 ? "" : "s"} available
          </div>

          {user?.role === "admin" && (
            <Link
              to="/admin/hackathon/new"
              className="btn-primary-glow inline-flex items-center gap-2 font-semibold shadow-lg"
            >
              <Plus className="size-4" />
              Create Hackathon
            </Link>
          )}
        </div>
      </header>

      {/* Filters and Search Bar */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status filter tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/30 p-1">
          {statusOptions.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                selectedStatus === status
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full rounded-xl border bg-card/80 py-2 pl-9 pr-9 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 backdrop-blur-sm"
            placeholder="Search by name, theme, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loading & Error States */}
      {events.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <p className="text-sm text-muted-foreground">Loading hackathons…</p>
        </div>
      )}

      {events.isError && (
        <div role="alert" className="glass-card p-8 text-center max-w-lg mx-auto">
          <p className="font-semibold text-destructive">{events.error.message}</p>
          <button
            className="btn-primary-glow mt-4 inline-block text-xs"
            onClick={() => events.refetch()}
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!events.isPending && !events.isError && filtered?.length === 0 && (
        <div className="glass-card p-12 text-center max-w-md mx-auto">
          <Layers className="size-10 text-muted-foreground/60 mx-auto mb-3" />
          <h3 className="text-lg font-bold">No hackathons found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? "No events match your current search or status filter. Try clearing filters."
              : "No upcoming hackathons yet. Check back soon or create one."}
          </p>
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedStatus("All");
              }}
              className="mt-4 text-xs font-semibold text-primary underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Hackathons Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered?.map((event) => {
          const stages = parseEventStages(event.stages);
          const bannerUrl = resolveBannerUrl(event.headerImage);

          return (
            <article
              key={event.id}
              className="group glass-card-hover flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:border-primary/40 bg-card"
            >
              {/* Header Image or Dark Tech Fallback Banner */}
              <div className="relative h-48 w-full overflow-hidden bg-zinc-950">
                {bannerUrl ? (
                  <>
                    <img
                      src={bannerUrl}
                      alt={event.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                    {/* Dark gradient scrim on top and bottom so text & badges ALWAYS pop */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/50" />
                  </>
                ) : (
                  /* High-contrast dark blueprint / tech grid canvas when NO image is set */
                  <div className="relative h-full w-full bg-zinc-950 p-6 flex flex-col justify-end text-white overflow-hidden border-b border-border/20">
                    {/* Subtle dot matrix pattern */}
                    <div
                      className="absolute inset-0 opacity-25"
                      style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, #71717a 1px, transparent 0)`,
                        backgroundSize: "18px 18px",
                      }}
                    />
                    {/* Vignette depth */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

                    {/* Decorative watermark */}
                    <div className="pointer-events-none absolute right-3 bottom-1 opacity-10 text-zinc-400">
                      <Layers className="size-24" />
                    </div>

                    <div className="relative z-10">
                      <h3 className="font-display text-lg font-bold line-clamp-1 text-white group-hover:text-primary transition-colors">
                        {event.name}
                      </h3>
                    </div>
                  </div>
                )}

                {/* Status Badge overlay - always anchored top-right with high-contrast backing */}
                <div className="absolute right-3 top-3 z-20">
                  <StatusBadge status={event.status} />
                </div>

                {/* Theme Tag Overlay bottom-left */}
                <div className="absolute bottom-3 left-3 z-20">
                  <span className="rounded-full bg-zinc-950/90 px-3 py-1 text-[11px] font-bold text-zinc-200 backdrop-blur-md border border-white/15 shadow-md">
                    {event.theme || "Hackathon"}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2">
                  <h2 className="font-display text-xl font-bold leading-tight group-hover:text-primary transition-colors">
                    {event.name}
                  </h2>
                </div>

                <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {event.description}
                </p>

                {/* Multi-stage Pill if stages defined */}
                {stages.length > 0 && (
                  <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1.5 text-[11px] font-medium text-foreground/80">
                    <Layers className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      {stages.length} Stage{stages.length === 1 ? "" : "s"}:{" "}
                      {stages.map((s) => s.title).join(" → ")}
                    </span>
                  </div>
                )}

                {/* Metadata List */}
                <div className="mt-auto space-y-2 border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-3.5 text-primary shrink-0" />
                    <span>
                      {event.startDate} → {event.endDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-amber-500 shrink-0" />
                    <span>
                      Reg. deadline: <strong>{event.registrationDeadline}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 text-primary shrink-0" />
                      <span>
                        {event.minTeamSize}–{event.maxTeamSize} per team
                      </span>
                    </div>

                    {event.location && (
                      <div className="flex items-center gap-1 text-[11px] truncate max-w-[140px]">
                        <MapPin className="size-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Link */}
                <Link
                  to={`/events/${event.id}${destination ? "#" + destination[1] : ""}`}
                  className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  <span>
                    {destination ? "Continue →" : "View Details & Register"}
                  </span>
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
