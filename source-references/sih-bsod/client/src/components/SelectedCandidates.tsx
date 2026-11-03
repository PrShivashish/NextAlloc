import React, { createContext, useContext, useState, ReactNode } from "react";

/**
 * Shared Candidate type used by Shortlist and Onboarding
 */
export interface Candidate {
  id: number;
  name: string;
  email: string;
  phone?: string;
  matchScore: number;
  skills: string[];
  experience?: string;
  role?: string;
  status?: "pending" | "offer_sent" | "accepted" | "rejected";
}

/** Selected entry keeps the candidate plus source (round + preference) */
export type SelectedEntry = {
  candidate: Candidate;
  roundIndex: number;
  prefIndex: number;
};

export type Round = {
  preferences: Candidate[][];
  selected: SelectedEntry[]; // selected entries for that round (keeps source info)
};

type ContextShape = {
  rounds: Round[];
  setRounds: (r: Round[]) => void;
  /** Add selected candidate with explicit source */
  addToSelected: (roundIndex: number, prefIndex: number, candidate: Candidate) => void;
  removeFromSelected: (roundIndex: number, candidateId: number) => void;
  removeCandidateCompletely: (candidateId: number) => void;
  removeFromAllSelected: (candidateId: number) => void;
};

const SelectedCandidatesContext = createContext<ContextShape | undefined>(undefined);

export const SelectedCandidatesProvider = ({ children }: { children: ReactNode }) => {
  // seed minimal initial structure (preferences empty — Shortlist will seed detailed prefs)
  const initialRound1Prefs: Candidate[][] = [[], [], []];

  const [rounds, setRounds] = useState<Round[]>([
    { preferences: initialRound1Prefs, selected: [] },
    { preferences: [[], [], []], selected: [] },
  ]);

  const addToSelected = (roundIndex: number, prefIndex: number, candidate: Candidate) => {
    setRounds(prev => {
      const copy = prev.map(r => ({ preferences: r.preferences.map(p => [...p]), selected: [...r.selected] }));
      // Add entry to that round's selected if not present (by candidate id)
      const already = copy[roundIndex].selected.some(s => s.candidate.id === candidate.id);
      if (!already) {
        copy[roundIndex].selected.push({ candidate, roundIndex, prefIndex });
      }
      return copy;
    });
  };

  const removeFromSelected = (roundIndex: number, candidateId: number) => {
    setRounds(prev => prev.map((r, idx) => ({
      preferences: r.preferences.map(p => [...p]),
      selected: idx === roundIndex ? r.selected.filter(s => s.candidate.id !== candidateId) : [...r.selected]
    })));
  };

  const removeCandidateCompletely = (candidateId: number) => {
    setRounds(prev => prev.map(r => ({
      preferences: r.preferences.map(pref => pref.filter(c => c.id !== candidateId)),
      selected: r.selected.filter(s => s.candidate.id !== candidateId)
    })));
  };

  const removeFromAllSelected = (candidateId: number) => {
    setRounds(prev => prev.map(r => ({
      preferences: r.preferences.map(p => [...p]),
      selected: r.selected.filter(s => s.candidate.id !== candidateId)
    })));
  };

  return (
    <SelectedCandidatesContext.Provider value={{
      rounds,
      setRounds,
      addToSelected,
      removeFromSelected,
      removeCandidateCompletely,
      removeFromAllSelected
    }}>
      {children}
    </SelectedCandidatesContext.Provider>
  );
};

export const useSelectedCandidates = () => {
  const ctx = useContext(SelectedCandidatesContext);
  if (!ctx) throw new Error("useSelectedCandidates must be used within SelectedCandidatesProvider");
  return ctx;
};
