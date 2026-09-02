/**
 * Da formato al texto que devuelve la IA: negritas, encabezados y viñetas.
 * Sin esto salía en crudo, con los asteriscos a la vista, lo que hacía difícil
 * de leer justo las respuestas largas.
 *
 * No es un intérprete de Markdown completo a propósito: solo lo que la IA usa
 * de verdad al responder en prosa. Lo comparten el asistente del cuaderno y el
 * de ayuda.
 */
export function RichText({ text }: { text: string }) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
      chunk.startsWith('**') && chunk.endsWith('**')
        ? <strong key={i}>{chunk.slice(2, -2)}</strong>
        : <span key={i}>{chunk}</span>);

  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    out.push(
      <ul key={`ul${out.length}`} style={{ margin: '6px 0 10px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bullets.map((b, i) => <li key={i}>{bold(b)}</li>)}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) { bullets.push(bullet[1]); return; }
    flush();

    const heading = /^\s*#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      out.push(<div key={idx} style={{ fontWeight: 700, fontSize: 14, margin: '12px 0 4px' }}>{bold(heading[1])}</div>);
      return;
    }
    if (line.trim() === '') { out.push(<div key={idx} style={{ height: 6 }} />); return; }
    out.push(<p key={idx} style={{ margin: '0 0 6px' }}>{bold(line)}</p>);
  });
  flush();

  return <>{out}</>;
}
