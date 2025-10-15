import type { NextApiRequest, NextApiResponse } from "next";
import { SyncService } from "@/services/sync";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      console.log(
        "/api/sync: Iniciando sincronización de visitas pendientes..."
      );
      await SyncService.syncPendingVisitas();
      console.log("/api/sync: Sincronización completada con éxito.");
      res
        .status(200)
        .json({ success: true, message: "Sincronización completada." });
    } catch (error) {
      console.error("/api/sync: Error durante la sincronización:", error);
      res
        .status(500)
        .json({ success: false, message: "Error en la sincronización." });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
