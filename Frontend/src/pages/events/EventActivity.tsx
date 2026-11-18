import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/services/apiClient";
import { eventsApi, type EventRecord } from "@/services/eventsApi";
import WorkflowForm, { fieldStyle } from "./WorkflowForm";

type Ticket = { id: string; subject: string; status: string; messages: { id: number; name: string; message: string }[] };
export default function EventActivity({ event }: { event: EventRecord }) {
  const { user } = useAuth();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  const owner = user?.role === "admin" && event.ownerId === user.id;
  const canReadTickets = owner || user?.role === "student";
  const base = "/api/hackathons/" + event.id;
  const cache = useQueryClient();
  const key = ["activity", event.id, user?.id];
  const notices = useQuery({ queryKey: [...key, "notices"], queryFn: () => apiRequest<{id: string; message: string}[]>(base + "/announcements") });
  const ranks = useQuery({ queryKey: [...key, "results"], queryFn: () => apiRequest<{teamId: string; team: string; score: number | null}[]>(base + "/leaderboard") });
  const tickets = useQuery({ queryKey: [...key, "tickets"], enabled: canReadTickets, queryFn: () => apiRequest<Ticket[]>(base + "/tickets") });
  const teams = useQuery({ queryKey: ["event", event.id, "organizer", "teams"], enabled: owner, queryFn: () => eventsApi.teams(event.id) });
  async function save(path: string, data: FormData, method = "POST") {
    await apiRequest(base + path, { method, body: JSON.stringify(Object.fromEntries(data)) });
    await cache.invalidateQueries({ queryKey: key });
  }
  return <div className="mt-6 space-y-6">
    <section id="announcements" className="glass-card space-y-3 p-6"><h2 className="text-2xl font-semibold">Announcements</h2>
      {notices.isError && <p role="alert">{notices.error.message}</p>}
      {notices.data?.length === 0 && <p>No announcements yet.</p>}
      {notices.data?.map(n => <p className="whitespace-pre-wrap break-words" key={n.id}>{n.message}</p>)}
      {owner && <WorkflowForm label="Post announcement" saved="Announcement posted." submit={d => save("/announcements", d)}>
        <label>Announcement<textarea className={fieldStyle} name="message" required maxLength={4000}/></label>
      </WorkflowForm>}
    </section>
    <section id="results" className="glass-card space-y-3 p-6"><h2 className="text-2xl font-semibold">Live judging results</h2>
      <p className="text-sm">Scores are the average out of 100 once every assigned judge has scored a team.</p>
      {ranks.isError && <p role="alert">{ranks.error.message}</p>}
      {ranks.data?.length === 0 && <p>No teams registered yet.</p>}
      <ul>{ranks.data?.map(row => <li className="break-words" key={row.teamId}>{row.team} — {row.score ?? "Pending"}</li>)}</ul>
      {teams.isError && <p role="alert">{teams.error.message}</p>}
      {owner && !!teams.data?.length && <WorkflowForm label="Assign judge" saved="Judge assigned." submit={d => save("/assignments", d)}>
        <label>Team to evaluate<select className={fieldStyle} name="teamId">{teams.data.map(t => <option key={t.id} value={t.id}>{t.teamName}</option>)}</select></label>
        <label>Judge email<input className={fieldStyle} required name="email" type="email"/></label>
      </WorkflowForm>}
    </section>
    {canReadTickets && <section id="support" className="glass-card space-y-5 p-6"><h2 className="text-2xl font-semibold">Event support</h2>
      {user?.role === "student" && <WorkflowForm label="Open ticket" saved="Ticket opened." submit={d => save("/tickets", d)}>
        <label>Subject<input className={fieldStyle} required maxLength={160} name="subject"/></label>
        <label>Question<textarea className={fieldStyle} required maxLength={4000} name="message"/></label>
      </WorkflowForm>}
      {tickets.isError && <p role="alert">{tickets.error.message}</p>}
      {tickets.data?.length === 0 && <p>No support tickets yet.</p>}
      {tickets.data?.map(t => <article key={t.id} className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold break-words">{t.subject} · {t.status}</h3>
        {t.messages.map(m => <p className="whitespace-pre-wrap break-words" key={m.id}><strong>{m.name}</strong> · {m.message}</p>)}
        <WorkflowForm label="Send reply" saved="Reply sent." submit={d => save("/tickets/" + t.id + "/messages", d)}>
          <label>Reply<textarea name="message" required maxLength={4000} className={fieldStyle}/></label>
        </WorkflowForm>
        {owner && <WorkflowForm label="Update status" reset={false} saved="Status updated." submit={d => save("/tickets/" + t.id, d, "PATCH")}>
          <label>Ticket status<select className={fieldStyle} defaultValue={t.status} name="status">{["Open","In Progress","Resolved"].map(s => <option key={s}>{s}</option>)}</select></label>
        </WorkflowForm>}
      </article>)}
    </section>}
  </div>;
}
