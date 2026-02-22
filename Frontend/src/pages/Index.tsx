import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Users, Brain, Shield, Trophy, ArrowRight, Calendar, Globe } from "lucide-react";

const features = [
  { icon: Users, title: "Team Registration", desc: "Seamless signup with face verification and duplicate detection" },
  { icon: Brain, title: "AI-Powered Judging", desc: "LLM-based PPT evaluation with combined AI + human scoring" },
  { icon: Shield, title: "Secure Verification", desc: "Face recognition and QR-based entry & meal tracking" },
  { icon: Trophy, title: "Live Leaderboard", desc: "Real-time rankings with exportable results" },
];

const mockHackathons = [
  { id: "1", name: "CodeSprint 2026", date: "Mar 15-16, 2026", teams: 42, status: "Open", theme: "FinTech" },
  { id: "2", name: "HackVerse", date: "Apr 5-6, 2026", teams: 78, status: "Open", theme: "HealthTech" },
  { id: "3", name: "BuildTheWeb", date: "May 20-21, 2026", teams: 120, status: "Coming Soon", theme: "EdTech" },
  { id: "4", name: "AI Summit Hack", date: "Jun 1-2, 2026", teams: 0, status: "Coming Soon", theme: "AI/ML" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function Index() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden pt-16">
        {/* BG effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute right-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-accent/10 blur-[100px]" />
        </div>

        <div className="container relative z-10 px-4 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
            <span className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              ⚡ Next-Gen Hackathon Platform
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mx-auto mb-6 max-w-4xl font-display text-5xl font-bold leading-tight md:text-7xl"
          >
            Manage Hackathons{" "}
            <span className="gradient-text">Like a Pro</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground"
          >
            AI-powered judging, face verification, real-time leaderboards — everything you need to run world-class hackathons from registration to results.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/role-select" className="btn-primary-glow flex items-center gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/hackathons" className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
              Browse Hackathons
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container px-4">
          <h2 className="mb-4 text-center font-display text-3xl font-bold md:text-4xl">
            Everything You Need
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-muted-foreground">
            A complete platform for organizers, participants, and judges.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="glass-card-hover p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Hackathon Cards */}
      <section className="border-t border-border/50 py-24">
        <div className="container px-4">
          <h2 className="mb-4 text-center font-display text-3xl font-bold md:text-4xl">
            Active Hackathons
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-muted-foreground">
            Join an upcoming hackathon or create your own.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {mockHackathons.map((h, i) => (
              <motion.div
                key={h.id}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="glass-card-hover flex flex-col p-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-primary">{h.theme}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      h.status === "Open" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {h.status}
                  </span>
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{h.name}</h3>
                <div className="mb-4 space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {h.date}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> {h.teams} teams
                  </div>
                </div>
                <Link
                  to="/role-select"
                  className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  View Details <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container flex items-center justify-between px-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold">HackManager</span>
          </div>
          <span>© 2026 All rights reserved</span>
        </div>
      </footer>
    </div>
  );
}
