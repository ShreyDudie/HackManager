import { Link } from "react-router-dom";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  Code2,
  Github,
  Layers3,
  QrCode,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import BuildScene from "@/components/landing/BuildScene";
import RolePreview from "@/components/landing/RolePreview";
import "@/styles/landing.css";

const steps = [
  {
    number: "01",
    icon: Users,
    title: "Find your people.",
    description:
      "Discover a hackathon, bring your team, and turn that “what if” into a plan.",
    label: "THE START",
    className: "people",
  },
  {
    number: "02",
    icon: Code2,
    title: "Make something real.",
    description:
      "Keep your rounds, presentations, and GitHub submissions together. Focus on the build.",
    label: "THE GOOD PART",
    className: "build",
  },
  {
    number: "03",
    icon: Trophy,
    title: "Have your moment.",
    description:
      "Share your work with judges, follow the leaderboard, and celebrate what you made.",
    label: "THE BIG FINISH",
    className: "celebrate",
  },
];

export default function Index() {
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <main id="main-content" className="landing-page">
        <section
          className="landing-hero landing-container"
          aria-labelledby="hero-title"
        >
          <motion.div
            className="hero-copy"
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
          >
            <p className="landing-eyebrow">
              <span className="eyebrow-dot" /> FOR THE ONES WHO BUILD
            </p>
            <h1 id="hero-title">
              Big ideas.
              <br />
              Late nights.
              <br />
              <span>Great builds.</span>
              <svg
                className="title-spark"
                aria-hidden="true"
                viewBox="0 0 50 50"
              >
                <path d="M25 2v46M2 25h46M9 9l32 32M9 41 41 9" />
              </svg>
            </h1>
            <p className="hero-description">
              A little less managing.
              <br className="desktop-break" /> A whole lot more making.
            </p>
            <p className="hero-detail">
              Your hackathon, from the first teammate to the final demo. All in
              one happy place.
            </p>
            <div className="hero-actions">
              <Link className="landing-button" to="/hackathons">
                Find your next hackathon <ArrowUpRight size={18} />
              </Link>
              <Link className="landing-text-link" to="/auth/signup?role=admin">
                Host an event <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-note">
              <span className="note-avatars" aria-hidden="true">
                <span>✳</span>
                <span>⌘</span>
                <span>↗</span>
              </span>
              <span>
                For curious minds.
                <br />
                <strong>And ambitious side projects.</strong>
              </span>
            </div>
          </motion.div>
          <BuildScene />
          <a href="#how-it-works" className="hero-scroll">
            <span>GOOD THINGS START WITH AN IDEA</span>
            <ArrowDown size={15} />
          </a>
        </section>

        <div className="landing-toolstrip" aria-label="Hackathon tools">
          <div className="landing-container">
            <span>
              EVERY PART OF THE HACK.
              <br />
              <strong>Finally, in sync.</strong>
            </span>
            <span>
              <Users /> Team registration
            </span>
            <span>
              <Github /> Project submissions
            </span>
            <span>
              <Sparkles /> AI-assisted judging
            </span>
            <span>
              <QrCode /> QR check-ins
            </span>
          </div>
        </div>

        <section
          id="how-it-works"
          className="landing-container landing-section"
        >
          <div className="section-heading">
            <div>
              <p className="landing-eyebrow">FROM “WHAT IF” TO “WE BUILT IT”</p>
              <h2>
                Your next big thing.
                <br />
                One great weekend away.
              </h2>
            </div>
            <p>
              More building. More breakthroughs.
              <br />
              Less “where do I submit this?”
            </p>
          </div>
          <div className="journey-grid">
            {steps.map((step, index) => (
              <motion.article
                key={step.number}
                className={`journey-card ${step.className}`}
                initial={reducedMotion ? false : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
              >
                <div className="journey-top">
                  <span>{step.label}</span>
                  <span>{step.number}</span>
                </div>
                <div className="journey-art" aria-hidden="true">
                  <step.icon strokeWidth={1.3} />
                  <span className="art-dot" />
                  <span className="art-plus">+</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <RolePreview />

        <section
          id="features"
          className="landing-container landing-section landing-features"
        >
          <div className="section-heading">
            <div>
              <p className="landing-eyebrow">SMALL DETAILS. BIG DIFFERENCE.</p>
              <h2>
                Bring the ideas.
                <br />
                We’ll bring the toolkit.
              </h2>
            </div>
            <Link to="/role-select" className="landing-text-link">
              Explore your workspace <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="feature-grid">
            <article>
              <span className="feature-icon">
                <QrCode />
              </span>
              <h3>Walk in. Get building.</h3>
              <p>
                QR entry, meal tokens, and face verification keep event
                check-ins in one place.
              </p>
            </article>
            <article>
              <span className="feature-icon">
                <Sparkles />
              </span>
              <h3>A fresh perspective.</h3>
              <p>
                AI-assisted project reviews give judges another perspective
                alongside their own expertise.
              </p>
            </article>
            <article>
              <span className="feature-icon">
                <Layers3 />
              </span>
              <h3>Every round, together.</h3>
              <p>
                Presentations, repository links, announcements, and results. A
                shared home for your event.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-container landing-cta">
          <div className="cta-doodle" aria-hidden="true">
            <Braces />
            <span>✳</span>
          </div>
          <div>
            <p className="landing-eyebrow">
              THE NEXT GREAT PROJECT COULD BE YOURS
            </p>
            <h2>
              Less admin.
              <br />
              <span>More “we did that.”</span>
            </h2>
            <Link to="/role-select" className="landing-button">
              Let’s build something <ArrowUpRight size={19} />
            </Link>
            <p className="cta-note">
              <Check size={14} /> Students, organizers, and judges welcome.
            </p>
          </div>
        </section>
        <footer className="landing-footer landing-container">
          <Link to="/" className="landing-brand">
            <span>
              <Zap size={19} fill="currentColor" />
            </span>
            HackManager<span className="brand-period">.</span>
          </Link>
          <p>Made for the joy of making.</p>
          <div>
            <Link to="/hackathons">Hackathons</Link>
            <Link to="/role-select">
              Get started <ArrowUpRight size={13} />
            </Link>
          </div>
        </footer>
      </main>
    </MotionConfig>
  );
}
