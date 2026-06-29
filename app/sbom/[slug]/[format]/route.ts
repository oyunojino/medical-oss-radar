import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string; format: string } }
) {
  const { slug, format } = params;
  if (format !== "cdx" && format !== "spdx") {
    return NextResponse.json({ error: "format must be cdx or spdx" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "sboms", `${slug}.${format}.json`);
  try {
    const text = await readFile(filePath, "utf8");
    return new NextResponse(text, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `inline; filename="${slug}.${format}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "SBOM not found" }, { status: 404 });
  }
}
