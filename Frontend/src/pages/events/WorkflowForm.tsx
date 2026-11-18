import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";

export const fieldStyle = "block w-full rounded-lg border bg-white p-2 mt-1";
export default function WorkflowForm({ children, label, submit, saved, reset = true }: {
  children: ReactNode; label: string; submit: (data: FormData) => Promise<unknown>; saved: string; reset?: boolean;
}) {
  const action = useMutation({ mutationFn: submit });
  return <form className="space-y-3" onSubmit={e => {
    e.preventDefault();
    const form = e.currentTarget;
    action.mutate(new FormData(form), { onSuccess: () => { if (reset) form.reset(); } });
  }}>
    {children}
    <button className="btn-primary-glow" disabled={action.isPending}>{label}</button>
    {action.isError && <p role="alert">{action.error.message}</p>}
    {action.isSuccess && <p role="status">{saved}</p>}
  </form>;
}
