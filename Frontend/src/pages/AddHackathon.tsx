// =============================================================================
// AddHackathon.tsx — Admin create hackathon with validations (Patch 6)
// endDate > startDate, registrationDeadline < startDate, min <= max.
// Inline error messages. Disable submit if invalid.
// =============================================================================

import DashboardSidebar from "@/components/DashboardSidebar";
import { LayoutDashboard, HelpCircle, ArrowLeft, QrCode } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { createHackathon, type Hackathon } from "@/lib/storage";

const sidebarItems = [
  { to: "/admin", label: "Hackathons", icon: LayoutDashboard },
  { to: "/admin/qr-monitor", label: "QR Monitor", icon: QrCode },
  { to: "/helpline", label: "Helpline", icon: HelpCircle },
];

interface FormState {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  minTeamSize: string;
  maxTeamSize: string;
  theme: string;
  rules: string;
}

export default function AddHackathon() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    minTeamSize: "2",
    maxTeamSize: "5",
    theme: "General",
    rules: "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});

  const update = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
  };

  // ── Validation Rules ──
  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) e.name = "Hackathon name is required";

    if (!form.startDate) {
      e.startDate = "Start date is required";
    }

    if (!form.endDate) {
      e.endDate = "End date is required";
    } else if (form.startDate && form.endDate <= form.startDate) {
      e.endDate = "End date must be after start date";
    }

    if (form.registrationDeadline && form.startDate &&
      form.registrationDeadline >= form.startDate) {
      e.registrationDeadline = "Registration deadline must be before start date";
    }

    const min = parseInt(form.minTeamSize) || 0;
    const max = parseInt(form.maxTeamSize) || 0;
    if (!form.minTeamSize || min < 1) e.minTeamSize = "Min size must be ≥ 1";
    if (!form.maxTeamSize || max < 1) e.maxTeamSize = "Max size must be ≥ 1";
    if (min > 0 && max > 0 && min > max) e.minTeamSize = "Min team size must be ≤ max";

    return e;
  }, [form]);

  const isFormValid = Object.keys(errors).length === 0 && form.name && form.startDate && form.endDate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Touch all fields to show errors
    const allTouched = Object.keys(form).reduce(
      (acc, k) => ({ ...acc, [k]: true }), {} as typeof touched
    );
    setTouched(allTouched);

    if (!isFormValid) {
      toast({ title: "Please fix validation errors", variant: "destructive" });
      return;
    }

    const dateRange = `${new Date(form.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(form.endDate).toLocaleDateString("en-US", { day: "numeric", year: "numeric" })}`;

    const newHackathon: Hackathon = {
      id: crypto.randomUUID().slice(0, 8),
      name: form.name.trim(),
      description: form.description,
      startDate: form.startDate,
      endDate: form.endDate,
      registrationDeadline: form.registrationDeadline,
      minTeamSize: form.minTeamSize,
      maxTeamSize: form.maxTeamSize,
      rounds: [],
      status: "Open",
      theme: form.theme || "General",
      date: dateRange,
      teams: 0,
      desc: form.description || "No description provided.",
      rules: form.rules,
      criteria: [],
      aiWeight: 50,
    };

    createHackathon(newHackathon);
    toast({ title: "Hackathon created!", description: form.name });
    navigate("/admin");
  };

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(key, e.target.value),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    className: `mt-1.5 ${touched[key] && errors[key] ? "border-destructive focus:border-destructive focus:ring-destructive" : ""}`,
  });

  return (
    <div className="flex min-h-screen pt-16">
      <DashboardSidebar items={sidebarItems} title="Admin" />
      <main className="flex-1 p-6 md:p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl">
          <Link to="/admin" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Hackathons
          </Link>
          <h1 className="mb-6 font-display text-2xl font-bold">Create Hackathon</h1>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="glass-card space-y-5 p-6">

              {/* Name */}
              <div>
                <Label>Hackathon Name *</Label>
                <Input {...field("name")} placeholder="e.g. InnovateFest 2026" />
                {touched.name && errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <Label>Description</Label>
                <Textarea
                  className="mt-1.5" rows={3} value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Brief description..."
                />
              </div>

              {/* Theme */}
              <div>
                <Label>Theme</Label>
                <Input {...field("theme")} placeholder="e.g. FinTech, HealthTech" />
              </div>

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Start Date *</Label>
                  <Input {...field("startDate")} type="date" />
                  {touched.startDate && errors.startDate && <p className="mt-1 text-xs text-destructive">{errors.startDate}</p>}
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Input {...field("endDate")} type="date" />
                  {touched.endDate && errors.endDate && <p className="mt-1 text-xs text-destructive">{errors.endDate}</p>}
                </div>
                <div>
                  <Label>Registration Deadline</Label>
                  <Input {...field("registrationDeadline")} type="date" />
                  {touched.registrationDeadline && errors.registrationDeadline && (
                    <p className="mt-1 text-xs text-destructive">{errors.registrationDeadline}</p>
                  )}
                </div>
              </div>

              {/* Team size */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Min Team Size</Label>
                  <Input {...field("minTeamSize")} type="number" min={1} />
                  {touched.minTeamSize && errors.minTeamSize && <p className="mt-1 text-xs text-destructive">{errors.minTeamSize}</p>}
                </div>
                <div>
                  <Label>Max Team Size</Label>
                  <Input {...field("maxTeamSize")} type="number" min={1} />
                  {touched.maxTeamSize && errors.maxTeamSize && <p className="mt-1 text-xs text-destructive">{errors.maxTeamSize}</p>}
                </div>
              </div>

              {/* Rules */}
              <div>
                <Label>Rules & Guidelines</Label>
                <Textarea
                  className="mt-1.5" rows={4} value={form.rules}
                  onChange={(e) => update("rules", e.target.value)}
                  placeholder="Enter rules and guidelines..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" asChild>
                <Link to="/admin">Cancel</Link>
              </Button>
              <Button
                type="submit"
                className="btn-primary-glow"
                disabled={Object.values(touched).some(Boolean) && !isFormValid}
                title={!isFormValid ? "Fix validation errors to continue" : ""}
              >
                Create Hackathon
              </Button>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  );
}