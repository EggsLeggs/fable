/** Runs before the Next.js server handles requests — patch https for Overmind OTLP ingest logging. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/overmind-https-patch");
  }
}
