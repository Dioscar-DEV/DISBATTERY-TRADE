"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, type VisitDraft } from "@/lib/indexedDB";

type DraftStepKey = keyof Pick<
  VisitDraft,
  "step1" | "step2" | "step3" | "step4" | "step5"
>;

export interface UseVisitDraftOptions {
  routePointId: string;
  clienteId: string;
  brand: "shell" | "qualid";
}

interface UseVisitDraftState {
  draftId?: string;
  draft?: VisitDraft | null;
  isSaving: boolean;
  lastSavedAt?: number;
}

export function useVisitDraft(options: UseVisitDraftOptions) {
  const { routePointId, clienteId, brand } = options;
  const [state, setState] = useState<UseVisitDraftState>({ isSaving: false });
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Crear o recuperar un borrador existente para el mismo punto
  const ensureDraft = useCallback(async (): Promise<string> => {
    const existing = await db.visitDrafts
      .where("routePointId")
      .equals(routePointId)
      .and((d) => d.status !== "synced")
      .first();

    if (existing) {
      setState((s) => ({ ...s, draftId: existing.id, draft: existing }));
      return existing.id;
    }

    const id = `draft_${routePointId}_${Date.now()}`;
    const now = Date.now();
    const draft: VisitDraft = {
      id,
      routePointId,
      clienteId,
      brand,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      version: now,
    } as VisitDraft;

    await db.visitDrafts.put(draft);
    setState((s) => ({ ...s, draftId: id, draft }));
    return id;
  }, [routePointId, clienteId, brand]);

  const load = useCallback(async () => {
    const id = await ensureDraft();
    const fresh = await db.visitDrafts.get(id);
    setState((s) => ({ ...s, draftId: id, draft: fresh || null }));
  }, [ensureDraft]);

  const saveStep = useCallback(
    async (stepKey: DraftStepKey, data: any) => {
      const id = state.draftId || (await ensureDraft());
      setState((s) => ({ ...s, isSaving: true }));
      const now = Date.now();
      await db.visitDrafts.update(id, {
        [stepKey]: data,
        updatedAt: now,
        version: now,
      } as Partial<VisitDraft>);
      const fresh = await db.visitDrafts.get(id);
      setState({
        draftId: id,
        draft: fresh || null,
        isSaving: false,
        lastSavedAt: now,
      });
    },
    [ensureDraft, state.draftId]
  );

  const setGpsData = useCallback(
    async (gpsData: NonNullable<VisitDraft["gpsData"]>) => {
      const id = state.draftId || (await ensureDraft());
      const now = Date.now();
      await db.visitDrafts.update(id, {
        gpsData,
        updatedAt: now,
        version: now,
      });
      setState((s) => ({ ...s, lastSavedAt: now }));
    },
    [ensureDraft, state.draftId]
  );

  const markCompleted = useCallback(async () => {
    if (!state.draftId) return;
    const now = Date.now();
    await db.visitDrafts.update(state.draftId, {
      status: "completed",
      updatedAt: now,
      version: now,
    });
    const fresh = await db.visitDrafts.get(state.draftId);
    setState((s) => ({ ...s, draft: fresh || null, lastSavedAt: now }));
  }, [state.draftId]);

  const clear = useCallback(async () => {
    if (!state.draftId) return;
    await db.visitDrafts.delete(state.draftId);
    setState({ isSaving: false });
  }, [state.draftId]);

  // Autosave helper (debounced)
  const autosave = useCallback(
    (stepKey: DraftStepKey, data: any, delayMs: number = 600) => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        saveStep(stepKey, data);
      }, delayMs);
    },
    [saveStep]
  );

  useEffect(() => {
    load();
    // Guardar estado al salir de la página si hay timer pendiente
    const handler = () => {
      if (autosaveTimer.current) {
        try {
          // noop, el setTimeout guardará
        } catch {}
      }
    };
    (window as Window).addEventListener("beforeunload", handler);
    return () => {
      (window as Window).removeEventListener("beforeunload", handler);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [load]);

  return useMemo(
    () => ({
      draftId: state.draftId,
      draft: state.draft,
      isSaving: state.isSaving,
      lastSavedAt: state.lastSavedAt,
      saveStep,
      autosave,
      load,
      clear,
      setGpsData,
      markCompleted,
    }),
    [state, saveStep, autosave, load, clear, setGpsData, markCompleted]
  );
}
