import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../../config/api";
import { getAccessHeaders } from "../../utils/premiumAccess";
import { getResumeFactsFormState, getResumeFactsPatch, prepareResumeFactsForSave } from "./resumeFactsForm";

const endpoint = `${API_BASE_URL}/api/resume/me/facts`;
const cleanState = () => ({ facts: getResumeFactsFormState(), baseline: {}, version: "", cycle: 0, edit: 0, isHydrating: true, userDirty: false, source: "hydration" });

export default function useResumeFactsForm({ cycleKey, active, onError, onSaved }) {
  const [state, setState] = useState(cleanState);
  const [saveState, setSaveState] = useState("idle");
  const current = useRef(state);
  const timer = useRef(null);
  const queue = useRef(Promise.resolve(true));
  const callbacks = useRef({ onError, onSaved });
  callbacks.current = { onError, onSaved };
  const publish = useCallback((next) => { current.current = next; setState(next); }, []);

  // A cycle changes synchronously before passive autosave effects can run.
  // Old GET responses and queued/debounced saves lose authority immediately.
  useLayoutEffect(() => {
    window.clearTimeout(timer.current);
    const cycle = current.current.cycle + 1;
    const controller = new AbortController();
    publish({ ...cleanState(), cycle });
    setSaveState("idle");
    if (active) {
      axios.get(endpoint, { headers: getAccessHeaders({ itemKey: "resume:facts" }), signal: controller.signal })
        .then(({ data }) => {
          if (current.current.cycle !== cycle || controller.signal.aborted) return;
          if (!data.facts || !data.version) throw new Error("Missing facts contract");
          const facts = getResumeFactsFormState(data.facts);
          publish({ ...current.current, facts, baseline: prepareResumeFactsForSave(facts), version: data.version, isHydrating: false, userDirty: false, source: "hydration" });
          setSaveState("saved");
        })
        .catch((err) => {
          if (current.current.cycle !== cycle || controller.signal.aborted) return;
          setSaveState("error");
          callbacks.current.onError?.(err.response?.data?.error || "تعذر تحميل بيانات السيرة. أعد فتح الصفحة للمحاولة.");
        });
    }
    return () => {
      controller.abort();
      window.clearTimeout(timer.current);
      current.current = { ...current.current, cycle: cycle + 1, isHydrating: true, userDirty: false, source: "navigation" };
    };
  }, [active, cycleKey, publish]);

  const edit = useCallback((value) => {
    const previous = current.current;
    if (previous.isHydrating) return;
    const facts = getResumeFactsFormState(value);
    publish({ ...previous, facts, edit: previous.edit + 1, userDirty: Object.keys(getResumeFactsPatch(previous.baseline, facts)).length > 0, source: "user-edit" });
  }, [publish]);

  const save = useCallback(async (expectedCycle = current.current.cycle) => {
    window.clearTimeout(timer.current);
    const execute = async () => {
      const snapshot = current.current;
      if (snapshot.cycle !== expectedCycle || snapshot.isHydrating) return false;
      if (!snapshot.userDirty || snapshot.source !== "user-edit") return true;
      const patch = getResumeFactsPatch(snapshot.baseline, snapshot.facts);
      if (!Object.keys(patch).length) return true;
      setSaveState("saving");
      try {
        const { data } = await axios.put(endpoint, patch, {
          headers: { ...getAccessHeaders({ itemKey: "resume:facts" }), "If-Match": snapshot.version },
        });
        if (current.current.cycle !== expectedCycle) return false;
        const latest = current.current;
        const changedSinceSubmit = Object.keys(getResumeFactsPatch(snapshot.facts, latest.facts)).length > 0;
        publish({ ...latest, baseline: prepareResumeFactsForSave(snapshot.facts), version: data.version, userDirty: changedSinceSubmit, source: changedSinceSubmit ? "user-edit" : "saved" });
        setSaveState("saved");
        callbacks.current.onSaved?.(data);
        return true;
      } catch (err) {
        if (current.current.cycle !== expectedCycle) return false;
        setSaveState("error");
        // No automatic retry loop. A stale revision requires fresh hydration.
        if (err.response?.status === 409) publish({ ...current.current, source: "conflict" });
        callbacks.current.onError?.(err.response?.data?.error || "تعذر حفظ بيانات السيرة. حاول مرة أخرى.");
        return false;
      }
    };
    const task = queue.current.catch(() => false).then(execute);
    queue.current = task;
    return task;
  }, [publish]);

  useEffect(() => {
    if (!active || !state.userDirty || state.isHydrating || state.source !== "user-edit") return undefined;
    const cycle = state.cycle;
    timer.current = window.setTimeout(() => save(cycle), 900);
    return () => window.clearTimeout(timer.current);
  }, [active, state.facts, state.userDirty, state.isHydrating, state.source, state.cycle, save]);

  return { facts: state.facts, isHydrating: state.isHydrating, userDirty: state.userDirty, saveState, edit, save };
}
