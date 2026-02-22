import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Scale, ShieldCheck, ArrowRight } from "lucide-react";

const roles = [
  {
    key: "student",
    label: "Student",
    icon: GraduationCap,
    desc: "Register your team, upload PPTs, track your progress through rounds.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    key: "judge",
    label: "Judge",
    icon: Scale,
    desc: "Review anonymized submissions, score teams, and evaluate presentations.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    key: "admin",
    label: "Admin",
    icon: ShieldCheck,
    desc: "Create hackathons, manage rounds, verify participants, view leaderboards.",
    color: "text-success",
    bg: "bg-success/10",
  },
];

export default function RoleSelect() {
  return (
    <div className="flex min-h-screen items-center justify-center pt-16">
      <div className="container max-w-4xl px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center">
          <h1 className="mb-3 font-display text-4xl font-bold">Choose Your Role</h1>
          <p className="text-muted-foreground">Select how you want to participate in the hackathon.</p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {roles.map((r, i) => (
            <motion.div
              key={r.key}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.2 }}
              className="glass-card-hover flex flex-col items-center p-8 text-center"
            >
              <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${r.bg}`}>
                <r.icon className={`h-8 w-8 ${r.color}`} />
              </div>
              <h2 className="mb-2 font-display text-xl font-semibold">{r.label}</h2>
              <p className="mb-6 text-sm text-muted-foreground">{r.desc}</p>
              <div className="mt-auto flex w-full flex-col gap-2">
                <Link
                  to={`/auth/signup?role=${r.key}`}
                  className="btn-primary-glow flex items-center justify-center gap-1.5 text-sm"
                >
                  Sign Up <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to={`/auth/login?role=${r.key}`}
                  className="rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Login
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
