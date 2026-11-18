import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/services/apiClient";
import { useAuth } from "@/context/AuthContext";
import type { Submission } from "@/services/eventsApi";
import SubmissionList from "./SubmissionList";
import WorkflowForm, { fieldStyle } from "./WorkflowForm";

type Assignment = { id: string; event: string; team: string; score: number | null; feedback: string; submissions: Submission[] };
export default function JudgeWorkspace() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const key = ["assignments", user.id];
  const list = useQuery({ queryKey: key, queryFn: () => apiRequest<Assignment[]>("/api/judge-assignments") });
  return <main className="container max-w-3xl space-y-6 pb-16 pt-28"><h1 className="text-4xl font-bold">Your judging assignments</h1>
    {list.isPending && <p>Loading assignments…</p>}{list.isError && <p role="alert">{list.error.message}</p>}
    {list.data?.length === 0 && <p>No teams have been assigned to you yet.</p>}
    {list.data?.map(a => <article className="glass-card space-y-4 p-6" key={a.id}>
      <p>{a.event}</p><h2 className="text-2xl font-semibold">{a.team}</h2><SubmissionList submissions={a.submissions}/>
      <WorkflowForm label="Save evaluation" saved="Evaluation saved." reset={false} submit={async d => {
        await apiRequest("/api/judge-assignments/" + a.id + "/score", { method: "PUT", body: JSON.stringify({ score: Number(d.get("score")), feedback: d.get("feedback") }) });
        await cache.invalidateQueries({ queryKey: key });
      }}>
        <label>Score out of 100<input className={fieldStyle} type="number" name="score" min="0" max="100" required defaultValue={a.score ?? ""}/></label>
        <label>Feedback<textarea className={fieldStyle} name="feedback" defaultValue={a.feedback} maxLength={4000}/></label>
      </WorkflowForm>
    </article>)}
  </main>;
}
