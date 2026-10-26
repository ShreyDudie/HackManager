import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/apiClient";
import { downloadSubmission, eventsApi, type EventRecord, type Member, type Submission } from "@/services/eventsApi";

const field = "mt-2 w-full rounded-lg border bg-white p-3";

function SubmissionList({ submissions }: { submissions: Submission[] }) {
  const download = useMutation({ mutationFn: (submission: Submission) => downloadSubmission(submission.fileUploadId!, submission.name) });
  return <div className="space-y-3">{submissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
    {submissions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 p-4">
      <span className="break-all">{item.name} <span className="text-xs text-muted-foreground">({item.kind})</span></span>
      {item.url && <a className="text-primary underline" href={item.url} target="_blank" rel="noreferrer">Open submission</a>}
      {item.fileUploadId && <button className="text-primary underline" disabled={download.isPending} onClick={() => download.mutate(item)}>Download PDF</button>}
    </div>)}{download.isError && <p role="alert">{download.error.message}</p>}</div>;
}

function StudentWorkspace({ event }: { event: EventRecord }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const key = ["event", event.id, user?.id];
  const team = useQuery({ queryKey: [...key, "team"], queryFn: async () => {
    try { return await eventsApi.myTeam(event.id); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  } });
  const submissions = useQuery({ queryKey: [...key, "submissions"], queryFn: () => eventsApi.submissions(event.id, false), enabled: !!team.data });
  const [members, setMembers] = useState<Member[]>([]);
  const [kind, setKind] = useState("github");
  const [purpose, setPurpose] = useState("entry");
  const register = useMutation({ mutationFn: (name: string) => eventsApi.register(event.id, name, members), onSuccess: () => cache.invalidateQueries({ queryKey: key }) });
  const submit = useMutation({ mutationFn: async (data: FormData) => {
    const file = data.get("file") as File | null;
    const name = String(data.get("name")); const url = String(data.get("url") || "");
    if (kind === "github") return eventsApi.submit(event.id, kind, { name, url });
    if (file?.size) {
      if (url) throw new Error("Choose either a PDF or a link, not both.");
      if (file.size > 10 * 1024 * 1024) throw new Error("PDF must be no larger than 10 MB.");
      const uploaded = await eventsApi.upload(file);
      return eventsApi.submit(event.id, kind, { name, fileId: uploaded.id });
    }
    return eventsApi.submit(event.id, kind, { name, link: url });
  }, onSuccess: () => cache.invalidateQueries({ queryKey: [...key, "submissions"] }) });
  const issue = useMutation({ mutationFn: (day: number) => eventsApi.issuePass(event.id, purpose, day) });
  if (team.isPending) return <p role="status">Loading your team…</p>;
  if (team.isError) return <p role="alert">{team.error.message}</p>;
  if (!team.data) return <section className="glass-card p-6 sm:p-8"><h2 className="mb-4 text-2xl font-semibold">Bring your team.</h2>
    {event.status !== "Open" || event.registrationDeadline < new Date().toISOString().slice(0, 10) ? <p>Registration is closed.</p> : <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); register.mutate(String(new FormData(e.currentTarget).get("teamName"))); }}>
      <p className="text-sm text-muted-foreground">You are the team leader. Add {event.minTeamSize - 1}–{event.maxTeamSize - 1} teammates.</p>
      <label className="block text-sm font-medium">Team name<input className={field} name="teamName" required minLength={2} maxLength={150} /></label>
      {members.map((member, index) => <fieldset key={index} className="rounded-xl border p-4"><legend className="px-2 text-sm">Teammate {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Name<input required className={field} value={member.name} onChange={(e) => setMembers((rows) => rows.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} /></label>
        <label className="text-sm">Email<input type="email" required className={field} value={member.email} onChange={(e) => setMembers((rows) => rows.map((row, i) => i === index ? { ...row, email: e.target.value } : row))} /></label>
      </div><button type="button" className="mt-3 text-sm text-destructive" onClick={() => setMembers((rows) => rows.filter((_, i) => i !== index))}>Remove teammate {index + 1}</button></fieldset>)}
      <div className="flex flex-wrap gap-4"><button type="button" className="rounded-lg border px-4 py-2" disabled={members.length >= event.maxTeamSize - 1} onClick={() => setMembers((rows) => [...rows, { name: "", email: "" }])}>Add teammate</button>
        <button className="btn-primary-glow disabled:opacity-50" disabled={register.isPending || members.length < event.minTeamSize - 1}>{register.isPending ? "Registering…" : "Register team"}</button></div>
      {register.isError && <p role="alert" className="text-destructive">{register.error.message}</p>}
    </form>}</section>;
  return <div className="space-y-6">
    <section className="glass-card p-6"><h2 className="text-2xl font-semibold">{team.data.teamName}</h2><p className="mt-2 text-sm text-success">Your team is registered.</p><ul className="mt-4 space-y-2">{team.data.members.map((member) => <li key={member.email} className="break-all">{member.name} <span className="text-sm text-muted-foreground">{member.email}</span></li>)}</ul></section>
    <section className="glass-card space-y-5 p-6"><h2 className="text-2xl font-semibold">Share what you’re building.</h2>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit.mutate(new FormData(e.currentTarget)); }}>
        <label className="block text-sm font-medium">Submission type<select className={field} value={kind} onChange={(e) => { setKind(e.target.value); submit.reset(); }}><option value="github">GitHub repository</option><option value="presentation">Presentation</option></select></label>
        <label className="block text-sm font-medium">Submission name<input className={field} name="name" required maxLength={150} /></label>
        <label className="block text-sm font-medium">{kind === "github" ? "GitHub URL" : "Presentation link (HTTPS)"}<input className={field} name="url" type="url" required={kind === "github"} placeholder={kind === "github" ? "https://github.com/your-team/project" : "https://…"} /></label>
        {kind === "presentation" && <label className="block text-sm font-medium">Or upload a PDF (up to 10 MB)<input className={field} name="file" type="file" accept="application/pdf,.pdf" /></label>}
        <button className="btn-primary-glow disabled:opacity-50" disabled={submit.isPending}>{submit.isPending ? "Saving…" : "Save submission"}</button>
        {submit.isError && <p role="alert" className="text-destructive">{submit.error.message}</p>}{submit.isSuccess && <p role="status" className="text-success">Submission saved.</p>}
      </form>{submissions.isError && <p role="alert">{submissions.error.message}</p>}<SubmissionList submissions={submissions.data || []} />
    </section>
    <section className="glass-card space-y-4 p-6"><h2 className="text-2xl font-semibold">Your check-in pass</h2><p className="text-sm text-muted-foreground">Generating a new pass replaces any unused pass for the same purpose. Used passes cannot be reused.</p>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); issue.mutate(purpose === "entry" ? 0 : Number(new FormData(e.currentTarget).get("day"))); }}>
        <label className="block text-sm font-medium">Pass type<select className={field} value={purpose} onChange={(e) => { setPurpose(e.target.value); issue.reset(); }}>{["entry", "breakfast", "lunch", "dinner"].map((value) => <option key={value}>{value}</option>)}</select></label>
        {purpose !== "entry" && <label className="block text-sm font-medium">Event day<input className={field} name="day" type="number" min={1} max={14} defaultValue={1} required /></label>}
        <button className="btn-primary-glow" disabled={issue.isPending}>Generate pass</button>
      </form>{issue.isError && <p role="alert" className="text-destructive">{issue.error.message}</p>}
      {issue.data && <div className="space-y-4"><div className="w-fit max-w-full bg-white p-4" aria-label="Check-in QR code"><QRCode value={issue.data.token} size={200} style={{ maxWidth: "100%", height: "auto" }} /></div><p className="text-sm">Expires {new Date(issue.data.expiresAt).toLocaleString()}</p><label className="block text-sm">Pass code<input readOnly className={field} value={issue.data.token} /></label></div>}
    </section>
  </div>;
}

function OrganizerWorkspace({ event }: { event: EventRecord }) {
  const cache = useQueryClient();
  const key = ["event", event.id, "organizer"];
  const teams = useQuery({ queryKey: [...key, "teams"], queryFn: () => eventsApi.teams(event.id), refetchInterval: 10000 });
  const submissions = useQuery({ queryKey: [...key, "submissions"], queryFn: () => eventsApi.submissions(event.id, true), refetchInterval: 10000 });
  const logs = useQuery({ queryKey: [...key, "checkins"], queryFn: () => eventsApi.checkins(event.id) });
  const redeem = useMutation({ mutationFn: eventsApi.redeem, onSuccess: () => cache.invalidateQueries({ queryKey: [...key, "checkins"] }) });
  return <div className="space-y-6"><section className="glass-card space-y-4 p-6"><h2 className="text-2xl font-semibold">Teams & submissions</h2>
    {(teams.isPending || submissions.isPending) && <p role="status">Loading teams and submissions…</p>}
    {(teams.isError || submissions.isError) && <p role="alert">{teams.error?.message || submissions.error?.message}</p>}
    {teams.data?.length === 0 && <p>No teams registered yet.</p>}
    {teams.data?.map((team) => <article className="space-y-4 rounded-xl border p-4" key={team.id}><h3 className="text-lg font-semibold">{team.teamName}</h3><p className="break-words text-sm text-muted-foreground">{team.members.map((member) => member.name).join(", ")}</p><SubmissionList submissions={submissions.data?.filter((item) => item.registrationId === team.id) || []} /></article>)}
  </section><section className="glass-card space-y-4 p-6"><h2 className="text-2xl font-semibold">Check in a team</h2><p className="text-sm text-muted-foreground">Paste a participant’s pass code, or use a USB QR scanner to enter it.</p>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); redeem.mutate(String(new FormData(e.currentTarget).get("token")).trim()); }}><label className="block text-sm font-medium">Check-in code<input className={field} name="token" required autoComplete="off" /></label><button className="btn-primary-glow" disabled={redeem.isPending}>Verify pass</button></form>
    {redeem.isError && <p role="alert" className="text-destructive">{redeem.error.message}</p>}{redeem.data && <p role="status" className={redeem.data.result === "valid" ? "text-success" : "text-destructive"}>{redeem.data.message}</p>}
    {logs.isError && <p role="alert">{logs.error.message}</p>}<ul className="space-y-2 text-sm">{logs.data?.map((log) => <li key={log.id}>{log.purpose} · {log.result} · {new Date(log.scannedAt).toLocaleString()}</li>)}</ul>
  </section></div>;
}

export default function EventWorkspace() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const event = useQuery({ queryKey: ["events", id], queryFn: () => eventsApi.get(id) });
  return <main className="container max-w-4xl px-4 pb-16 pt-28"><Link to="/hackathons" className="text-primary">← All events</Link>
    {event.isPending && <p role="status" className="mt-8">Loading event…</p>}{event.isError && <p role="alert" className="mt-8">{event.error.message}</p>}
    {event.data && <><header className="my-8"><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">{event.data.theme || "Build together"}</p><h1 className="break-words text-4xl font-bold">{event.data.name}</h1><p className="my-4 whitespace-pre-wrap text-muted-foreground">{event.data.description}</p><p className="text-sm">{event.data.startDate} — {event.data.endDate} · {event.data.minTeamSize}–{event.data.maxTeamSize} people per team</p><p className="mt-2 text-sm">Registration closes {event.data.registrationDeadline} (UTC)</p>{event.data.rules && <details className="mt-4"><summary className="cursor-pointer text-primary">Event rules</summary><p className="mt-3 whitespace-pre-wrap">{event.data.rules}</p></details>}</header>
      {!user && <Link className="btn-primary-glow inline-block" to="/auth/login?role=student">Sign in to register</Link>}
      {user?.role === "student" && <StudentWorkspace key={`${id}-${user.id}`} event={event.data} />}
      {user?.role === "admin" && event.data.ownerId === user.id && <OrganizerWorkspace key={id} event={event.data} />}
    </>}
  </main>;
}
