export const runtime = "edge";

const logoFiles = {
  png: {
    fileName: "WildWorks-logo.png",
    contentType: "image/png",
  },
  svg: {
    fileName: "WildWorks-logo.svg",
    contentType: "image/svg+xml; charset=utf-8",
  },
} as const;

type LogoFormat = keyof typeof logoFiles;

export async function GET(request: Request) {
  const formatParam = new URL(request.url).searchParams.get("format");
  const format: LogoFormat = formatParam === "png" ? "png" : "svg";
  const logoFile = logoFiles[format];
  const assetUrl = new URL(`/${logoFile.fileName}`, request.url);
  const logoResponse = await fetch(assetUrl, { cache: "no-store" });

  if (!logoResponse.ok) {
    return new Response("Logo file not found.", { status: 404 });
  }

  return new Response(logoResponse.body, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${logoFile.fileName}"`,
      "Content-Type": logoFile.contentType,
    },
  });
}
