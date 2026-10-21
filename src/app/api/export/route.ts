import { authed } from "@/lib/api";
import { exportCsv } from "@/lib/store";

export const GET = authed(async () =>
  new Response(await exportCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="recursify-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  }),
);
