export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ maxWidth: 520, padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Page not found</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Turkchain DEX UI
        </p>
        <a href="/" style={{ display: "inline-block", marginTop: 16 }}>
          Go home
        </a>
      </div>
    </main>
  );
}
