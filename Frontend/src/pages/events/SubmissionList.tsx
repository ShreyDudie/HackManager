import { useMutation } from "@tanstack/react-query";
import { downloadSubmission, type Submission } from "@/services/eventsApi";

export default function SubmissionList({ submissions }: { submissions: Submission[] }) {
  const download = useMutation({ mutationFn: (submission: Submission) => downloadSubmission(submission.fileUploadId!, submission.name) });
  return <div className="space-y-3">{submissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
    {submissions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 p-4">
      <span className="break-all">{item.name} <span className="text-xs text-muted-foreground">({item.kind})</span></span>
      {item.url && <a className="text-primary underline" href={item.url} target="_blank" rel="noreferrer">Open submission</a>}
      {item.fileUploadId && <button className="text-primary underline" disabled={download.isPending} onClick={() => download.mutate(item)}>Download PDF</button>}
    </div>)}{download.isError && <p role="alert">{download.error.message}</p>}</div>;
}
