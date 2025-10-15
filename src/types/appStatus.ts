// Shared status constants and types for routes, points and sync
export const RouteStatus = {
  PLANNED: "planificada" as const,
  IN_PROGRESS: "en_progreso" as const,
  COMPLETED: "completada" as const,
};

export type RouteStatusType = (typeof RouteStatus)[keyof typeof RouteStatus];

export const PointStatus = {
  PENDING: "pendiente" as const,
  VISITED: "visitado" as const,
  OMITTED: "omitido" as const,
};

export type PointStatusType = (typeof PointStatus)[keyof typeof PointStatus];

export const SyncStatus = {
  PENDING: "pending" as const,
  PROCESSING: "processing" as const,
  SYNCED: "synced" as const,
  ERROR: "error" as const,
};

export type SyncStatusType = (typeof SyncStatus)[keyof typeof SyncStatus];
