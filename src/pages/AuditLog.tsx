import { useMemo, useState } from 'react';
import { ScrollText, Download, Search, Trash2, ShieldCheck } from 'lucide-react';
import {
  ACTION_LABEL, ACTION_COLOR, ENTITY_LABEL, ENTITY_GROUPS,
  auditToCsv, dayKeyOf, friendlyDay, formatTime, MAX_ENTRIES,
  type AuditEntry,
} from '../services/audit';
import { useToast } from '../components/ui/Toast';
import { plural } from '../lib/utils';

interface Props {
  auditLog: AuditEntry[];
  onClear: () => void;
}

export function AuditLog({ auditLog, onClear }: Props) {
  const { toast } = useToast();
  const [group, setGroup] = useState<string>('all');
  const [who, setWho]     = useState<string>('all');
  const [query, setQuery] = useState('');

  /** Quiénes han tocado algo, para poder filtrar por persona. */
  const people = useMemo(
    () => [...new Set(auditLog.map(e => e.who))].sort((a, b) => a.localeCompare(b, 'es')),
    [auditLog],
  );

  const filtered = useMemo(() => {
    const allowed = group === 'all'
      ? null
      : new Set(ENTITY_GROUPS.find(g => g.id === group)?.entities ?? []);
    const q = query.trim().toLowerCase();

    return auditLog.filter(e => {
      if (allowed && !allowed.has(e.entity)) return false;
      if (who !== 'all' && e.who !== who) return false;
      if (q && !`${e.what} ${e.detail ?? ''} ${e.who}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [auditLog, group, who, query]);

  /** Agrupado por día natural, que es como se busca «lo de ayer». */
  const byDay = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    filtered.forEach(e => {
      const key = dayKeyOf(e.at);
      const list = map.get(key);
      if (list) list.push(e); else map.set(key, [e]);
    });
    return [...map.entries()];
  }, [filtered]);

  function exportCsv() {
    if (filtered.length === 0) { toast('No hay nada que exportar con estos filtros'); return; }
    const url = URL.createObjectURL(new Blob([auditToCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro-de-cambios-${dayKeyOf(new Date().toISOString())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ Registro descargado');
  }

  function askClear() {
    if (!confirm(
      'Se borrará todo el registro de cambios.\n\n' +
      'Los datos (notas, alumnos, evaluaciones) NO se tocan: solo desaparece el ' +
      'historial de quién cambió qué. Esta acción no se puede deshacer.',
    )) return;
    onClear();
    toast('Registro vaciado');
  }

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">Registro de cambios</h1>
          <p className="pg-sub">
            {auditLog.length > 0
              ? `${plural(auditLog.length, 'cambio registrado', 'cambios registrados')}`
              : 'Quién cambió qué, y cuándo'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download size={14} />Descargar CSV
          </button>
          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={askClear} disabled={auditLog.length === 0}>
            <Trash2 size={14} />Vaciar
          </button>
        </div>
      </div>

      {auditLog.length === 0 ? (
        <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <ScrollText size={38} color="var(--text-3)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
            Todavía no hay nada anotado
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
            A partir de ahora, cada nota que pongas, cada alumno que añadas y cada evaluación
            que guardes dejará constancia aquí: qué era antes, qué es ahora y quién lo hizo.
          </p>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <FilterChip label="Todo" on={group === 'all'} onClick={() => setGroup('all')} />
            {ENTITY_GROUPS.map(g => (
              <FilterChip key={g.id} label={g.label} on={group === g.id} onClick={() => setGroup(g.id)} />
            ))}

            <div style={{ flex: 1, minWidth: 12 }} />

            {people.length > 1 && (
              <select
                className="finput" value={who} onChange={e => setWho(e.target.value)}
                style={{ width: 170, height: 38, cursor: 'pointer' }}
              >
                <option value="all">Todos los docentes</option>
                {people.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}

            <div style={{ position: 'relative', width: 232 }}>
              <Search size={14} color="var(--text-3)" style={{ position: 'absolute', left: 11, top: 12 }} />
              <input
                className="finput" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar un alumno, una prueba…"
                style={{ height: 38, paddingLeft: 32 }}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
                Ningún cambio coincide con lo que buscas.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {byDay.map(([day, entries]) => (
                <div key={day} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    padding: '11px 18px', borderBottom: '0.5px solid var(--border)',
                    background: 'var(--surface)', fontSize: 11.5, fontWeight: 800,
                    color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{friendlyDay(day)}</span>
                    <span style={{ color: 'var(--text-3)', letterSpacing: 0 }}>
                      {plural(entries.length, 'cambio', 'cambios')}
                    </span>
                  </div>
                  {entries.map((e, i) => <Row key={e.id} entry={e} first={i === 0} />)}
                </div>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '13px 16px',
            background: 'var(--surface)', borderRadius: 11, fontSize: 12,
            color: 'var(--text-2)', lineHeight: 1.6,
          }}>
            <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              El registro se guarda con tus datos y entra en las copias de seguridad. Se conservan
              los <strong style={{ color: 'var(--text)' }}>{MAX_ENTRIES}</strong> cambios más recientes;
              a partir de ahí los más antiguos se van descartando. Si compartes trabajo con otro docente,
              aquí verás también lo que llega de su equipo.
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px', borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
        fontSize: 13, fontWeight: on ? 700 : 500,
        background: on ? 'var(--accent-l)' : 'transparent',
        border: `1.5px solid ${on ? 'var(--accent-d)' : 'var(--border)'}`,
        color: on ? 'var(--accent-d)' : 'var(--text-2)',
      }}
    >
      {label}
    </button>
  );
}

function Row({ entry, first }: { entry: AuditEntry; first: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px',
      borderTop: first ? 'none' : '0.5px solid var(--border)',
    }}>
      <span style={{
        flexShrink: 0, width: 44, fontSize: 12, fontWeight: 700,
        color: 'var(--text-3)', fontFamily: 'ui-monospace, Menlo, monospace', paddingTop: 1,
      }}>
        {formatTime(entry.at)}
      </span>

      <span style={{
        flexShrink: 0, padding: '2px 9px', borderRadius: 7, fontSize: 11, fontWeight: 800,
        background: `${ACTION_COLOR[entry.action]}18`, color: ACTION_COLOR[entry.action],
      }}>
        {ACTION_LABEL[entry.action]}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.45 }}>
          {entry.what}
        </div>
        {entry.detail && (
          <div style={{
            fontSize: 12.5, color: 'var(--text-2)', marginTop: 3,
            fontFamily: 'ui-monospace, Menlo, monospace',
          }}>
            {entry.detail}
          </div>
        )}
      </div>

      <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-3)', textAlign: 'right', paddingTop: 2 }}>
        <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-2)' }}>{entry.who}</span>
        {ENTITY_LABEL[entry.entity]}
      </span>
    </div>
  );
}
