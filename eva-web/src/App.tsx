import { Component, useCallback, useEffect, useRef, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles/mood-journal.css";
import SavedPlanDetail from "./pages/SavedPlanDetail.jsx";
import SavedPlans from "./pages/SavedPlans.jsx";
import WorkoutDashboard from "./pages/WorkoutDashboard.jsx";
import WorkoutPlanner from "./pages/WorkoutPlanner.jsx";
import WorkoutProgress from "./pages/WorkoutProgress.jsx";
import WorkoutSession from "./pages/WorkoutSession.jsx";
import FitnessDashboard from "./components/FitnessDashboard.jsx";
import MoodCheckIn from "./components/MoodCheckIn.jsx";
import MoodJournal from "./pages/MoodJournal.jsx";
import LiveEvent from "./pages/LiveEvent.jsx";
import OshiMatch from "./pages/OshiMatch.jsx";
import { useMoodJournal } from "./hooks/useMoodJournal.js";
import WorkoutPage from "./pages/WorkoutPage";
import DashboardPage from "./pages/DashboardPage";
import LibraryPage from "./pages/LibraryPage";
import SessionPlayPage from "./pages/SessionPlayPage";
import RoutineView from "./pages/RoutineView";
import "./styles/workout.css";
import "./styles/session.css";

function isDesktopShell() {
  return (
    window.__EVA_PLATFORM__ === "desktop" || Boolean(window.companion?.isDesktop)
  );
}

class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err || "render failed") };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="eva-chat-fallback">
          Eva 介面載入失敗：{this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

function ChatPage() {
  const desktop = isDesktopShell();
  const bootedRef = useRef(false);
  const {
    isCheckInOpen,
    logEntry,
    closeCheckIn,
    setIsCheckInOpen,
  } = useMoodJournal({ autoPrompt: !desktop });

  const bindHost = useCallback((el: HTMLDivElement | null) => {
    if (!el || bootedRef.current) return;
    bootedRef.current = true;
    void import("./main.js")
      .then((mod) => {
        if (typeof mod.initChat === "function") {
          mod.initChat(el);
        }
      })
      .catch((err) => {
        el.textContent = `Chat 載入失敗：${err instanceof Error ? err.message : String(err)}`;
      });
  }, []);

  useEffect(() => {
    const onOpen = () => setIsCheckInOpen(true);
    window.addEventListener("eva:open-mood-checkin", onOpen);
    return () => window.removeEventListener("eva:open-mood-checkin", onOpen);
  }, [setIsCheckInOpen]);

  return (
    <>
      <div className="eva-chat-page">
        <div ref={bindHost} className="eva-chat-host" />
      </div>
      <MoodCheckIn
        open={isCheckInOpen}
        onClose={closeCheckIn}
        onSubmit={(mood, note, tags) => logEntry(mood, note, tags)}
      />
    </>
  );
}

export default function App() {
  const desktop = isDesktopShell();
  return (
    <ChatErrorBoundary>
    <HashRouter>
      {desktop ? (
        <Routes>
          <Route path="*" element={<ChatPage />} />
        </Routes>
      ) : (
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/workout" element={<WorkoutPlanner />} />
        <Route path="/workout/routine" element={<RoutineView />} />
        <Route path="/workout/track" element={<WorkoutPage />} />
        <Route path="/workout/track/dashboard" element={<DashboardPage />} />
        <Route path="/workout/track/library" element={<LibraryPage />} />
        <Route path="/workout/plans" element={<SavedPlans />} />
        <Route path="/workout/plans/:planId" element={<SavedPlanDetail />} />
        <Route path="/workout/session" element={<WorkoutSession />} />
        <Route path="/workout/play" element={<SessionPlayPage />} />
        <Route path="/workout/dashboard" element={<WorkoutDashboard />} />
        <Route path="/workout/progress" element={<WorkoutProgress />} />
        <Route path="/fitness" element={<FitnessDashboard />} />
        <Route path="/mood" element={<MoodJournal />} />
        <Route path="/live" element={<LiveEvent />} />
        <Route path="/oshi" element={<OshiMatch />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      )}
    </HashRouter>
    </ChatErrorBoundary>
  );
}
