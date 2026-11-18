import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/services/apiClient";

export default function FaceProfile() {
  const [file, setFile] = useState<File>();
  const action = useMutation({ mutationFn: async (mode: "register" | "verify") => {
    if (!file || file.size > 5 * 1024 * 1024) throw new Error("Choose an image up to 5 MB.");
    const body = new FormData();
    body.append("file", file);
    const result = await apiRequest<{ message?: string; verified?: boolean }>("/api/face/" + mode, { method: "POST", body });
    return result.message || (result.verified ? "Face matched." : "Face did not match.");
  }});
  return <main className="container max-w-xl space-y-6 pt-28"><h1 className="text-4xl font-bold">Your face profile</h1>
    <p>Registering saves your photo and its face measurements. To check a match, choose a second photo and select Verify.</p>
    <label className="block">Face photo (up to 5 MB)<input type="file" accept="image/*" capture="user" className="mt-2 block w-full" onChange={e => {setFile(e.target.files?.[0]); action.reset();}}/></label>
    <div className="flex flex-wrap gap-3">{(["register","verify"] as const).map(mode => <button className="btn-primary-glow" key={mode} disabled={!file || action.isPending} onClick={() => action.mutate(mode)}>{mode === "register" ? "Register photo" : "Verify photo"}</button>)}</div>
    {action.isError && <p role="alert">{action.error.message}</p>}{action.isSuccess && <p role="status">{action.data}</p>}
  </main>;
}
