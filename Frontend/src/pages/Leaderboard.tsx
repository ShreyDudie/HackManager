// =============================================================================
// Leaderboard.tsx — Dynamic public leaderboard
// Reads hackathons and judge scores from localStorage.
// Shows leaderboard per hackathon with proper ranking.
// =============================================================================

import { motion } from "framer-motion";
import { Trophy, Medal, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  getHackathons,
  getJudgeAssignments,
  type Hackathon,
  type JudgeAssignment,
} from "@/lib/storage";

interface LeaderboardEntry {
  rank: number;
  teamName: string;
  aiScore: number | null;
  judgeScore: number | null;
  final: number;
}

export default function Leaderboard() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Load hackathons
  useEffect(() => {
    const loaded = getHackathons();
    setHackathons(loaded);
    if (loaded.length > 0) {
      setSelectedHackathonId(loaded[0].id);
    }
  }, []);

  // Build leaderboard when hackathon changes
  useEffect(() => {
    if (!selectedHackathonId) return;

    const hackathon = hackathons.find((h) => h.id === selectedHackathonId);
    const aiWeight = hackathon?.aiWeight ?? 50;
    const assignments = getJudgeAssignments(undefined, selectedHackathonId);

    // Group scores by team
    const teamScores: Record<string, { aiScore: number | null; judgeScore: number | null }> = {};

    assignments.forEach((a) => {
      if (!teamScores[a.teamName]) {
        teamScores[a.teamName] = { aiScore: a.aiScore, judgeScore: a.judgeScore };
      } else {
        if (a.aiScore != null) teamScores[a.teamName].aiScore = a.aiScore;
        if (a.judgeScore != null) {
          const existing = teamScores[a.teamName].judgeScore;
          teamScores[a.teamName].judgeScore = existing != null
            ? Math.round((existing + a.judgeScore) / 2)
            : a.judgeScore;
        }
      }
    });

    // Calculate final scores and sort
    const entries: LeaderboardEntry[] = Object.entries(teamScores)
      .map(([teamName, scores]) => {
        const ai = scores.aiScore || 0;
        const judge = scores.judgeScore || 0;
        const final = Math.round((aiWeight / 100) * ai + ((100 - aiWeight) / 100) * judge);
        return { rank: 0, teamName, aiScore: scores.aiScore, judgeScore: scores.judgeScore, final };
      })
      .sort((a, b) => b.final - a.final)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    setLeaderboard(entries);
  }, [selectedHackathonId, hackathons]);

  const rankStyles: Record<number, string> = {
    1: "border-warning/50 bg-warning/5",
    2: "border-muted-foreground/30 bg-muted/20",
    3: "border-orange-600/30 bg-orange-600/5",
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="container max-w-4xl px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="mb-8 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-warning" />
            <div>
              <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
              <p className="text-sm text-muted-foreground">Live rankings</p>
            </div>
          </div>

          {/* Hackathon selector */}
          {hackathons.length > 0 ? (
            <>
              <div className="mb-8">
                <select
                  value={selectedHackathonId}
                  onChange={(e) => setSelectedHackathonId(e.target.value)}
                  className="rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {hackathons.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              {leaderboard.length === 0 ? (
                <div className="glass-card p-12 text-center text-muted-foreground">
                  <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm">No scores submitted yet for this hackathon.</p>
                </div>
              ) : (
                <>
                  {/* Top 3 podium */}
                  {leaderboard.length >= 3 && (
                    <div className="mb-8 grid grid-cols-3 gap-4">
                      {[1, 0, 2].map((idx) => {
                        const t = leaderboard[idx];
                        if (!t) return null;
                        return (
                          <motion.div
                            key={t.rank}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`glass-card flex flex-col items-center p-6 ${idx === 0 ? "order-2 scale-105" : idx === 1 ? "order-1" : "order-3"
                              }`}
                          >
                            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                              {t.rank === 1 ? (
                                <Trophy className="h-5 w-5 text-warning" />
                              ) : (
                                <Medal className={`h-5 w-5 ${t.rank === 2 ? "text-muted-foreground" : "text-orange-500"}`} />
                              )}
                            </div>
                            <p className="font-display text-lg font-bold">{t.teamName}</p>
                            <p className="mt-2 font-display text-2xl font-bold text-primary">{t.final}</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Full table */}
                  <div className="glass-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-xs text-muted-foreground">
                          <th className="px-6 py-3 text-left font-medium">Rank</th>
                          <th className="px-6 py-3 text-left font-medium">Team</th>
                          <th className="px-6 py-3 text-right font-medium">AI Score</th>
                          <th className="px-6 py-3 text-right font-medium">Judge Score</th>
                          <th className="px-6 py-3 text-right font-medium">Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {leaderboard.map((t) => (
                          <tr key={t.rank} className={`transition-colors hover:bg-muted/30 ${rankStyles[t.rank] || ""}`}>
                            <td className="px-6 py-3 font-display font-bold">{t.rank}</td>
                            <td className="px-6 py-3 font-medium">{t.teamName}</td>
                            <td className="px-6 py-3 text-right">{t.aiScore ?? "—"}</td>
                            <td className="px-6 py-3 text-right">{t.judgeScore ?? "—"}</td>
                            <td className="px-6 py-3 text-right font-semibold text-primary">{t.final}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="glass-card p-12 text-center text-muted-foreground">
              <p className="text-sm">No hackathons available yet.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
