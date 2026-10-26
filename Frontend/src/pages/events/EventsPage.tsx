import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ArrowUpRight, Plus, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { eventsApi } from "@/services/eventsApi";

export default function EventsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const events = useQuery({ queryKey: ["events"], queryFn: eventsApi.list });
  const filtered = events.data?.filter((event) => `${event.name} ${event.theme}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="container max-w-6xl px-4 pb-16 pt-28">
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Make something that matters</p>
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Your next big idea starts here.</h1>
        <p className="mt-4 max-w-xl text-muted-foreground">Find your event, bring your team, and turn a weekend of building into something worth sharing.</p></div>
      {user?.role === "admin" && <Link className="btn-primary-glow inline-flex items-center gap-2" to="/admin/hackathon/new"><Plus size={18} />Create event</Link>}
    </header>
    <label className="mb-8 block max-w-md text-sm font-medium">Find a hackathon
      <input className="mt-2 w-full rounded-xl border bg-card p-3" placeholder="Search by name or theme" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {events.isPending && <p role="status">Loading events…</p>}
    {events.isError && <div role="alert" className="glass-card p-6"><p>{events.error.message}</p><button className="mt-3 text-primary underline" onClick={() => events.refetch()}>Try again</button></div>}
    {filtered?.length === 0 && <p className="glass-card p-8">{search ? "No matching events. Try another search." : "No events yet. Check back soon."}</p>}
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{filtered?.map((event) => <article key={event.id} className="glass-card-hover flex flex-col p-6">
      <div className="mb-6 flex justify-between gap-2 text-xs font-medium"><span className="text-primary">{event.theme || "Campus hackathon"}</span><span className="rounded-full bg-secondary px-3 py-1">{event.status}</span></div>
      <h2 className="text-2xl font-semibold">{event.name}</h2><p className="mb-6 mt-3 line-clamp-3 text-sm text-muted-foreground">{event.description}</p>
      <p className="mt-auto flex items-center gap-2 text-sm"><CalendarDays size={16} />{event.startDate} — {event.endDate}</p>
      <p className="mb-6 mt-2 flex items-center gap-2 text-sm"><Users size={16} />{event.minTeamSize}–{event.maxTeamSize} people per team</p>
      <Link to={`/events/${event.id}`} className="flex items-center justify-between border-t pt-4 font-medium text-primary">View event <ArrowUpRight size={18} /></Link>
    </article>)}</div>
  </main>;
}
