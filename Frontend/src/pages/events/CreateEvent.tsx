import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { eventsApi } from "@/services/eventsApi";
import { ApiError } from "@/services/apiClient";

export default function CreateEvent() {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const create = useMutation({ mutationFn: eventsApi.create, onSuccess: (event) => { cache.invalidateQueries({ queryKey: ["events"] }); navigate(`/events/${event.id}`); } });
  const fieldErrors = (create.error instanceof ApiError ? create.error.fields : undefined) || {};
  const hasError = (field: string) => !!fieldErrors[field]?.length;
  const errorMsg = (field: string) => fieldErrors[field]?.[0];
  const inputClass = (field: string) => `mt-2 w-full rounded-lg border p-3 ${hasError(field) ? "border-destructive ring-1 ring-destructive" : ""}`;

  return <main className="container max-w-3xl px-4 pb-16 pt-28"><Link to="/admin" className="text-primary">← Your events</Link>
    <h1 className="mb-3 mt-6 text-4xl font-bold">Set the stage.</h1><p className="mb-8 text-muted-foreground">Give your next hackathon a place to begin.</p>
    <form className="glass-card space-y-5 p-6 sm:p-8" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      create.mutate({ name: String(data.get("name")), description: String(data.get("description")), theme: String(data.get("theme")), rules: String(data.get("rules")), startDate: String(data.get("startDate")), endDate: String(data.get("endDate")), registrationDeadline: String(data.get("registrationDeadline")), minTeamSize: Number(data.get("minTeamSize")), maxTeamSize: Number(data.get("maxTeamSize")), status: data.get("status") as "Open" | "Coming Soon" });
    }}>
      <label className="block text-sm font-medium">Event name
        <input name="name" required minLength={3} maxLength={150} className={inputClass("name")} />
        {hasError("name") && <p className="mt-1 text-xs text-destructive">{errorMsg("name")}</p>}
      </label>
      <label className="block text-sm font-medium">Description
        <textarea name="description" required maxLength={5000} className={inputClass("description")} />
        {hasError("description") && <p className="mt-1 text-xs text-destructive">{errorMsg("description")}</p>}
      </label>
      <label className="block text-sm font-medium">Theme
        <input name="theme" maxLength={300} className={inputClass("theme")} />
        {hasError("theme") && <p className="mt-1 text-xs text-destructive">{errorMsg("theme")}</p>}
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["startDate", "Start date"], ["endDate", "End date"], ["registrationDeadline", "Registration deadline"]].map(([name, label]) => (
          <label key={name} className="block text-sm font-medium">{label}
            <input name={name} type="date" required className={`mt-2 w-full min-w-0 rounded-lg border p-3 ${hasError(name) ? "border-destructive ring-1 ring-destructive" : ""}`} />
            {hasError(name) && <p className="mt-1 text-xs text-destructive">{errorMsg(name)}</p>}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[["minTeamSize", "Minimum team size", 1], ["maxTeamSize", "Maximum team size", 4]].map(([name, label, value]) => (
          <label key={name} className="block text-sm font-medium">{label}
            <input name={String(name)} type="number" min={1} max={50} defaultValue={value} required className={inputClass(String(name))} />
            {hasError(String(name)) && <p className="mt-1 text-xs text-destructive">{errorMsg(String(name))}</p>}
          </label>
        ))}
      </div>
      <label className="block text-sm font-medium">Rules
        <textarea name="rules" maxLength={10000} className={inputClass("rules")} />
        {hasError("rules") && <p className="mt-1 text-xs text-destructive">{errorMsg("rules")}</p>}
      </label>
      <label className="block text-sm font-medium">Registration status
        <select name="status" className={inputClass("status")}><option>Coming Soon</option><option>Open</option></select>
      </label>
      {create.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{create.error.message}</p>}
      <button className="btn-primary-glow disabled:opacity-50" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create event"}</button>
    </form></main>;
}
