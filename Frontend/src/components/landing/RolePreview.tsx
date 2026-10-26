import { useState } from "react";
import { Link } from "react-router-dom";
import { USE_EXPRESS } from "@/services/apiClient";
import {
  ArrowUpRight,
  Check,
  Circle,
  LayoutDashboard,
  PanelsTopLeft,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";

const roles = [
  {
    id: "student",
    label: "For builders",
    icon: Users,
    heading: "Your team. Your next big idea.",
    description:
      "Find your event, bring your teammates, and keep every submission in sight. You take care of the idea. We’ll keep the details together.",
    checks: [
      "Register your team in one place",
      "Submit presentations and GitHub projects",
      "Keep up with rounds and announcements",
    ],
    cta: "Start building",
    workspace: "TEAM WORKSPACE",
    title: "Let’s make it happen.",
    subtitle: "Your project journey, all in one place.",
    tasks: [
      "Assemble your dream team",
      "Bring your idea to life",
      "Get ready for demo day",
    ],
    stat: "Next up",
    value: "The big idea",
    pill: "In the making",
  },
  {
    id: "admin",
    label: "For organizers",
    icon: PanelsTopLeft,
    heading: "Big event. Fewer moving parts.",
    description:
      "Give your hackathon a home. Set up rounds, manage registrations, and keep everyone on the same page from kickoff to results.",
    checks: [
      "Create your event and its rounds",
      "Manage teams and QR check-ins",
      "Assign judges and share announcements",
    ],
    cta: "Host your hackathon",
    workspace: "ORGANIZER WORKSPACE",
    title: "Set the stage for great ideas.",
    subtitle: "One place to keep your event moving.",
    tasks: [
      "Create your hackathon",
      "Welcome teams and judges",
      "Open the first round",
    ],
    stat: "Your focus",
    value: "A great event",
    pill: "Ready to launch",
  },
  {
    id: "judge",
    label: "For judges",
    icon: Trophy,
    heading: "Give great work its spotlight.",
    description:
      "Explore assigned projects, use AI-assisted reviews, and add your own perspective. Help the best ideas get the recognition they deserve.",
    checks: [
      "See your assigned teams and projects",
      "Review presentations and repositories",
      "Combine your expertise with AI insights",
    ],
    cta: "Join as a judge",
    workspace: "JUDGE WORKSPACE",
    title: "Meet the next big thing.",
    subtitle: "Fresh ideas. Thoughtful feedback.",
    tasks: [
      "Explore assigned projects",
      "Review the details",
      "Submit your evaluation",
    ],
    stat: "Your focus",
    value: "Bright ideas",
    pill: "Ready to review",
  },
];

export default function RolePreview() {
  const [role, setRole] = useState("student");

  return (
    <section id="your-workspace" className="role-section">
      <div className="landing-container">
        <p className="landing-eyebrow">
          DIFFERENT ROLES. ONE SHARED ADVENTURE.
        </p>
        <h2>
          A place for every
          <br />
          kind of game-changer.
        </h2>
        <Tabs value={role} onValueChange={setRole} className="role-tabs">
          <TabsList className="role-tab-list" aria-label="Explore workspaces">
            {roles.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="role-tab">
                <item.icon size={16} />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {roles.map((item) => (
            <TabsContent key={item.id} value={item.id} className="role-panel">
              <motion.div
                className="role-copy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <h3>{item.heading}</h3>
                <p>{item.description}</p>
                <ul>
                  {item.checks.map((check) => (
                    <li key={check}>
                      <Check size={16} />
                      {check}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/auth/${USE_EXPRESS && item.id !== "student" ? "login" : "signup"}?role=${item.id}`}
                  className="landing-text-link"
                >
                  {item.cta}
                  <ArrowUpRight size={18} />
                </Link>
              </motion.div>
              <div
                className="workspace-preview"
                aria-label={`${item.label} example workspace`}
              >
                <div className="preview-top">
                  <span>
                    <LayoutDashboard size={15} />
                    {item.workspace}
                  </span>
                  <span>ILLUSTRATIVE PREVIEW</span>
                </div>
                <div className="preview-body">
                  <span className="preview-pill">
                    <span />
                    {item.pill}
                  </span>
                  <h4>{item.title}</h4>
                  <p>{item.subtitle}</p>
                  <div className="preview-tasks">
                    {item.tasks.map((task, index) => (
                      <div key={task}>
                        {index === 0 ? (
                          <span className="task-done">
                            <Check size={13} />
                          </span>
                        ) : (
                          <Circle size={18} />
                        )}
                        <span>{task}</span>
                        <span>0{index + 1}</span>
                      </div>
                    ))}
                  </div>
                  <div className="preview-bottom">
                    <span>
                      <small>{item.stat}</small>
                      <strong>{item.value}</strong>
                    </span>
                    <span className="preview-spark">
                      <Sparkles />
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
