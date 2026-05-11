"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type {
  Candidate,
  CandidateDetail,
  CandidateDetailResponse,
  Criteria,
  ResumeRecord,
} from "@/types";

const STORAGE_KEY = "bibi-recruiter-workflow-v4";

type RecruitingState = {
  rawJD: string;
  refinedJD: string;
  criteria: Criteria | null;
  idealCandidateProfile: string;
  resumeTexts: Record<string, string>;
  resumes: ResumeRecord[];
  candidates: Candidate[];
  selectedCandidateDetail: CandidateDetail | null;
  candidateDetails: Record<string, CandidateDetail>;
};

type RecruitingContextValue = RecruitingState & {
  setJobRefinement: (payload: {
    rawJD: string;
    refinedJD: string;
    criteria: Criteria;
    idealCandidateProfile: string;
  }) => void;
  updateCriteria: (criteria: Criteria) => void;
  addResumes: (resumes: ResumeRecord[], resumeTexts: Record<string, string>) => void;
  removeResume: (resumeId: number) => void;
  setCandidates: (candidates: Candidate[]) => void;
  setCandidateDetail: (
    candidateId: number,
    detail: CandidateDetailResponse | CandidateDetail,
  ) => void;
  resetWorkflow: () => void;
};

type Action =
  | {
      type: "setJobRefinement";
      payload: {
        rawJD: string;
        refinedJD: string;
        criteria: Criteria;
        idealCandidateProfile: string;
      };
    }
  | { type: "updateCriteria"; criteria: Criteria }
  | {
      type: "addResumes";
      resumes: ResumeRecord[];
      resumeTexts: Record<string, string>;
    }
  | { type: "removeResume"; resumeId: number }
  | { type: "setCandidates"; candidates: Candidate[] }
  | {
      type: "setCandidateDetail";
      candidateId: number;
      detail: CandidateDetailResponse | CandidateDetail;
    }
  | { type: "reset" };

const initialState: RecruitingState = {
  rawJD: "",
  refinedJD: "",
  criteria: null,
  idealCandidateProfile: "",
  resumeTexts: {},
  resumes: [],
  candidates: [],
  selectedCandidateDetail: null,
  candidateDetails: {},
};

const RecruitingContext = createContext<RecruitingContextValue | null>(null);

export function RecruitingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(recruitingReducer, initialState);

  useEffect(() => {
    clearPersistedState();
  }, []);

  const setJobRefinement = useCallback(
    (payload: {
      rawJD: string;
      refinedJD: string;
      criteria: Criteria;
      idealCandidateProfile: string;
    }) => dispatch({ type: "setJobRefinement", payload }),
    [],
  );

  const updateCriteria = useCallback(
    (criteria: Criteria) => dispatch({ type: "updateCriteria", criteria }),
    [],
  );

  const addResumes = useCallback(
    (resumes: ResumeRecord[], resumeTexts: Record<string, string>) =>
      dispatch({ type: "addResumes", resumes, resumeTexts }),
    [],
  );

  const removeResume = useCallback(
    (resumeId: number) => dispatch({ type: "removeResume", resumeId }),
    [],
  );

  const setCandidates = useCallback(
    (candidates: Candidate[]) => dispatch({ type: "setCandidates", candidates }),
    [],
  );

  const setCandidateDetail = useCallback(
    (candidateId: number, detail: CandidateDetailResponse | CandidateDetail) =>
      dispatch({ type: "setCandidateDetail", candidateId, detail }),
    [],
  );

  const resetWorkflow = useCallback(() => {
    clearPersistedState();
    dispatch({ type: "reset" });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      setJobRefinement,
      updateCriteria,
      addResumes,
      removeResume,
      setCandidates,
      setCandidateDetail,
      resetWorkflow,
    }),
    [
      addResumes,
      removeResume,
      resetWorkflow,
      setCandidateDetail,
      setCandidates,
      setJobRefinement,
      state,
      updateCriteria,
    ],
  );

  return <RecruitingContext.Provider value={value}>{children}</RecruitingContext.Provider>;
}

export function useRecruitingStore() {
  const context = useContext(RecruitingContext);

  if (!context) {
    throw new Error("useRecruitingStore must be used inside RecruitingProvider.");
  }

  return context;
}

function recruitingReducer(state: RecruitingState, action: Action): RecruitingState {
  switch (action.type) {
    case "setJobRefinement":
      return {
        ...state,
        rawJD: action.payload.rawJD,
        refinedJD: action.payload.refinedJD,
        criteria: action.payload.criteria,
        idealCandidateProfile: action.payload.idealCandidateProfile,
        candidates: [],
        selectedCandidateDetail: null,
        candidateDetails: {},
      };
    case "updateCriteria":
      return {
        ...state,
        criteria: action.criteria,
        candidates: [],
        selectedCandidateDetail: null,
        candidateDetails: {},
      };
    case "addResumes":
      return {
        ...state,
        resumes: [...state.resumes, ...action.resumes],
        resumeTexts: {
          ...state.resumeTexts,
          ...action.resumeTexts,
        },
        candidates: [],
        selectedCandidateDetail: null,
        candidateDetails: {},
      };
    case "removeResume": {
      const remainingTexts = Object.fromEntries(
        Object.entries(state.resumeTexts).filter(([id]) => id !== String(action.resumeId)),
      );

      return {
        ...state,
        resumes: state.resumes.filter((resume) => resume.id !== action.resumeId),
        resumeTexts: remainingTexts,
        candidates: state.candidates.filter((candidate) => candidate.id !== action.resumeId),
        selectedCandidateDetail:
          state.selectedCandidateDetail?.candidateId === action.resumeId
            ? null
            : state.selectedCandidateDetail,
        candidateDetails: Object.fromEntries(
          Object.entries(state.candidateDetails).filter(([id]) => id !== String(action.resumeId)),
        ),
      };
    }
    case "setCandidates":
      return {
        ...state,
        candidates: action.candidates,
        selectedCandidateDetail: null,
        candidateDetails: {},
      };
    case "setCandidateDetail": {
      const detail = {
        ...action.detail,
        candidateId: action.candidateId,
      };

      return {
        ...state,
        selectedCandidateDetail: detail,
        candidateDetails: {
          ...state.candidateDetails,
          [String(action.candidateId)]: detail,
        },
      };
    }
    case "reset":
      return initialState;
    default:
      return state;
  }
}

function clearPersistedState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}
