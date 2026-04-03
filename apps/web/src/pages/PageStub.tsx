interface PageStubProps {
  title: string;
  hint?: string;
}

const s: Record<string, React.CSSProperties> = {
  root: { padding: "40px 32px", fontFamily: "'Courier New', monospace" },
  title: {
    fontSize: 10,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "rgba(80,160,255,0.6)",
    fontWeight: 700,
    marginBottom: 8,
  },
  hint: { fontSize: 8.5, color: "rgba(55,115,195,0.3)" },
};

export function PageStub({ title, hint = "— не реализовано" }: PageStubProps) {
  return (
    <div style={s.root}>
      <div style={s.title}>{title}</div>
      <div style={s.hint}>{hint}</div>
    </div>
  );
}
