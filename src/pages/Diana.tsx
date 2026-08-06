import { useState, useMemo, useCallback } from 'react';
import { Sparkles, RotateCcw, Save, ChevronDown } from 'lucide-react';
import type { Class, Student, Evaluation, DianaProfile } from '../types';
import type { InlineFile } from '../services/gemini';
import { DIANA_SECTORS, isoDate } from '../lib/utils';
import { callGemini, parseGeminiJson } from '../services/gemini';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  students: Student[];
  evaluations: Evaluation[];
  lawDocument: InlineFile | null;
  dianaProfiles: Record<string, DianaProfile>;
  onSaveDiana: (studentId: string, profile: DianaProfile) => void;
}

type SectorId = 'ds1' | 'ds2' | 'ds3' | 'ds4' | 'ds5' | 'ds6';
type ScoreMap = Record<SectorId, number>;
type DescriptorMap = Record<SectorId, string>;

const SECTOR_IDS = DIANA_SECTORS.map(s => s.id) as SectorId[];
const N = DIANA_SECTORS.length; // 6
const RINGS = 4; // levels 1-4
const SVG_SIZE = 320;
const CENTER = SVG_SIZE / 2;
const MAX_RADIUS = 120;

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  2: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
  3: { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
  4: { bg: '#dcfce7', text: '#16a34a', border: '#86efac' },
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Insuficiente',
  2: 'Suficiente',
  3: 'Bien',
  4: 'Excelente',
};

function angleForIndex(i: number): number {
  // Start from top (-π/2), go clockwise
  return (2 * Math.PI * i) / N - Math.PI / 2;
}

function polarToCart(angle: number, r: number): [number, number] {
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function hexagonPoints(radius: number): string {
  return DIANA_SECTORS.map((_, i) => {
    const [x, y] = polarToCart(angleForIndex(i), radius);
    return `${x},${y}`;
  }).join(' ');
}

function scorePolygonPoints(scores: ScoreMap): string {
  return SECTOR_IDS.map((id, i) => {
    const val = scores[id] ?? 0;
    const r = (val / RINGS) * MAX_RADIUS;
    const [x, y] = polarToCart(angleForIndex(i), r);
    return `${x},${y}`;
  }).join(' ');
}

function emptyScores(): ScoreMap {
  return { ds1: 0, ds2: 0, ds3: 0, ds4: 0, ds5: 0, ds6: 0 };
}

function emptyDescriptors(): DescriptorMap {
  return { ds1: '', ds2: '', ds3: '', ds4: '', ds5: '', ds6: '' };
}

interface DianaChartProps {
  scores: ScoreMap;
  onSetScore: (sectorId: SectorId, level: number) => void;
  selectedSector: SectorId | null;
  onSelectSector: (id: SectorId | null) => void;
}

function DianaChart({ scores, onSetScore, selectedSector, onSelectSector }: DianaChartProps) {
  const { t } = useI18n();
  const ringRadii = Array.from({ length: RINGS }, (_, i) => ((i + 1) / RINGS) * MAX_RADIUS);
  const filled = SECTOR_IDS.filter(id => scores[id] > 0);

  /** El color de la figura lo marca el nivel medio, para que se lea de un vistazo. */
  const avg = filled.length
    ? filled.reduce((a, id) => a + scores[id], 0) / filled.length
    : 0;
  const shade = LEVEL_COLORS[Math.max(1, Math.round(avg))] ?? LEVEL_COLORS[3];

  return (
    <svg
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      style={{ overflow: 'visible', userSelect: 'none' }}
    >
      <defs>
        <radialGradient id="diana-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={shade.text} stopOpacity={0.34} />
          <stop offset="100%" stopColor={shade.text} stopOpacity={0.13} />
        </radialGradient>
      </defs>

      {/* Fondo: da cuerpo al gráfico sin competir con los datos */}
      <polygon points={hexagonPoints(MAX_RADIUS)} fill="var(--surface)" fillOpacity={0.55} />

      {/* Anillos, muy tenues: son referencia, no protagonistas */}
      {ringRadii.map((r, ri) => (
        <polygon
          key={`ring-${ri}`}
          points={hexagonPoints(r)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={ri === RINGS - 1 ? 1.5 : 1}
          strokeOpacity={ri === RINGS - 1 ? 0.9 : 0.45}
        />
      ))}

      {/* Ejes */}
      {DIANA_SECTORS.map((s, i) => {
        const [x, y] = polarToCart(angleForIndex(i), MAX_RADIUS);
        return (
          <line
            key={`axis-${s.id}`}
            x1={CENTER} y1={CENTER} x2={x} y2={y}
            stroke="var(--border)"
            strokeWidth={1}
            strokeOpacity={selectedSector === s.id ? 1 : 0.5}
          />
        );
      })}

      {/* La figura */}
      {filled.length > 0 && (
        <polygon
          points={scorePolygonPoints(scores)}
          fill="url(#diana-fill)"
          stroke={shade.text}
          strokeWidth={2.5}
          strokeLinejoin="round"
          style={{ transition: 'all 0.25s ease' }}
        />
      )}

      {/*
        Zonas de clic invisibles: un tramo por nivel a lo largo de cada eje.
        Así se puntúa haciendo clic donde quieras del eje, sin necesidad de
        dibujar veinticuatro puntos que ensucian el gráfico.
      */}
      {DIANA_SECTORS.map((s, i) =>
        ringRadii.map((r, ri) => {
          const prevR = ri === 0 ? 0 : ringRadii[ri - 1];
          const angle = angleForIndex(i);
          const [x1, y1] = polarToCart(angle, prevR);
          const [x2, y2] = polarToCart(angle, r);
          return (
            <line
              key={`hit-${s.id}-${ri}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="transparent"
              strokeWidth={30}
              strokeLinecap="round"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                onSelectSector(s.id as SectorId);
                onSetScore(s.id as SectorId, ri + 1);
              }}
            >
              <title>{`${t(s.label)}: ${t(LEVEL_LABELS[ri + 1])}`}</title>
            </line>
          );
        })
      )}

      {/* Un punto por competencia, solo en su nivel actual */}
      {DIANA_SECTORS.map((s, i) => {
        const val = scores[s.id as SectorId] ?? 0;
        if (val === 0) return null;
        const [cx, cy] = polarToCart(angleForIndex(i), (val / RINGS) * MAX_RADIUS);
        const c = LEVEL_COLORS[val];
        return (
          <circle
            key={`v-${s.id}`}
            cx={cx} cy={cy}
            r={selectedSector === s.id ? 7 : 5.5}
            fill={c.text}
            stroke="#fff"
            strokeWidth={2.5}
            style={{ pointerEvents: 'none', transition: 'r 0.15s ease' }}
          />
        );
      })}

      {/* Sector labels */}
      {DIANA_SECTORS.map((s, i) => {
        const angle = angleForIndex(i);
        const labelR = MAX_RADIUS + 32;
        const [lx, ly] = polarToCart(angle, labelR);
        const isSelected = selectedSector === s.id;

        // Determine text anchor based on position
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        const cosA = Math.cos(angle);
        if (cosA > 0.2) anchor = 'start';
        else if (cosA < -0.2) anchor = 'end';

        return (
          <g
            key={`label-${s.id}`}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectSector(isSelected ? null : (s.id as SectorId))}
          >
            <text
              x={lx}
              y={ly - 6}
              textAnchor={anchor}
              fontSize={13}
              fill={isSelected ? 'var(--accent-d)' : 'var(--text)'}
              fontWeight={isSelected ? 800 : 600}
              fontFamily="var(--font)"
            >
              {s.icon}
            </text>
            <text
              x={lx}
              y={ly + 9}
              textAnchor={anchor}
              fontSize={10}
              fill={isSelected ? 'var(--accent-d)' : 'var(--text-2)'}
              fontWeight={isSelected ? 800 : 600}
              fontFamily="var(--font)"
            >
              {t(s.label)}
            </text>
            {scores[s.id as SectorId] > 0 && (
              <text
                x={lx}
                y={ly + 21}
                textAnchor={anchor}
                fontSize={10}
                fill="var(--accent-d)"
                fontWeight={800}
                fontFamily="var(--font)"
              >
                {t('Nv.{n}', { n: scores[s.id as SectorId] })}
              </text>
            )}
          </g>
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={2.5} fill="var(--border)" />
    </svg>
  );
}

export function Diana({ classes, students, evaluations, lawDocument, dianaProfiles, onSaveDiana }: Props) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [scores, setScores] = useState<ScoreMap>(emptyScores());
  const [descriptors, setDescriptors] = useState<DescriptorMap>(emptyDescriptors());
  const [selectedSector, setSelectedSector] = useState<SectorId | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);

  const classStudents = useMemo(
    () => students.filter(s => s.class_id === classId),
    [students, classId]
  );

  const student = useMemo(
    () => students.find(s => s.id === studentId) ?? null,
    [students, studentId]
  );

  const studentEvals = useMemo(
    () => evaluations.filter(e => e.student_id === studentId),
    [evaluations, studentId]
  );

  const handleClassChange = useCallback((id: string) => {
    setClassId(id);
    setStudentId('');
    setScores(emptyScores());
    setDescriptors(emptyDescriptors());
    setSelectedSector(null);
    setSaved(false);
  }, []);

  const handleStudentChange = useCallback((id: string) => {
    setStudentId(id);
    // Restaura la diana guardada del alumno, si existe
    const saved = dianaProfiles[id];
    setScores(saved ? { ...emptyScores(), ...saved.scores } as ScoreMap : emptyScores());
    setDescriptors(saved ? { ...emptyDescriptors(), ...saved.descriptors } as DescriptorMap : emptyDescriptors());
    setSelectedSector(null);
    setSaved(false);
  }, [dianaProfiles]);

  const handleSetScore = useCallback((sectorId: SectorId, level: number) => {
    setScores(prev => ({ ...prev, [sectorId]: level }));
    setSaved(false);
  }, []);

  const handleReset = useCallback(() => {
    setScores(emptyScores());
    setDescriptors(emptyDescriptors());
    setSelectedSector(null);
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!studentId) return;
    onSaveDiana(studentId, { scores, descriptors, updated: isoDate() });
    setSaved(true);
    toast(t('✅ Diana guardada'));
    setTimeout(() => setSaved(false), 2000);
  }, [studentId, scores, descriptors, onSaveDiana, toast, t]);

  const handleAiSuggest = useCallback(async () => {
    if (!student) return;

    const cls = classes.find(c => c.id === classId);

    const evalSummary = studentEvals.length === 0
      ? (lang === 'en' ? 'No previous assessments recorded.' : 'Sin evaluaciones previas registradas.')
      : studentEvals.map(e => {
          const criteriaLines = Object.entries(e.scores)
            .map(([k, v]) => lang === 'en' ? `  - ${k}: level ${v}/4` : `  - ${k}: nivel ${v}/4`)
            .join('\n');
          return lang === 'en'
            ? `Rubric "${e.rubric_name}" (${e.date}):\n${criteriaLines}${e.notes ? `\n  Notes: ${e.notes}` : ''}`
            : `Rúbrica "${e.rubric_name}" (${e.date}):\n${criteriaLines}${e.notes ? `\n  Notas: ${e.notes}` : ''}`;
        }).join('\n\n');

    const systemPrompt = lang === 'en'
      ? `You are an expert in competency-based education. Analyse a student's assessment history and generate scores for the Learner Profile with 6 key competencies (1-4 scale) and short, concrete descriptors for each. Reply ONLY with valid JSON, no extra text.`
      : `Eres un experto en educación competencial. Analiza el historial de evaluaciones de un alumno y genera puntuaciones para la Diana Competencial con 6 competencias clave (escala 1-4) y descriptores breves y concretos para cada una. Responde ÚNICAMENTE con JSON válido, sin texto adicional.`;

    const userPrompt = lang === 'en' ? `Student: ${student.name}
Class: ${cls?.name ?? 'N/A'} — ${cls?.subject ?? ''}
Teacher's notes: ${student.notes || 'None'}

Assessment history:
${evalSummary}

Generate the Learner Profile with scores (1=Below expectations, 2=Approaching expectations, 3=Meeting expectations, 4=Exceeding expectations) and descriptors, in English, for:
- ds1: Communication
- ds2: Mathematics
- ds3: Digital
- ds4: Social
- ds5: Learning to learn
- ds6: Enterprise

JSON format:
{
  "scores": {"ds1": 3, "ds2": 2, "ds3": 3, "ds4": 4, "ds5": 3, "ds6": 2},
  "descriptors": {
    "ds1": "Short descriptor about Communication...",
    "ds2": "Short descriptor about Mathematics...",
    "ds3": "Short descriptor about Digital...",
    "ds4": "Short descriptor about Social...",
    "ds5": "Short descriptor about Learning to learn...",
    "ds6": "Short descriptor about Enterprise..."
  }
}` : `Alumno: ${student.name}
Clase: ${cls?.name ?? 'N/A'} — ${cls?.subject ?? ''}
Notas del profesor: ${student.notes || 'Ninguna'}

Historial de evaluaciones:
${evalSummary}

Genera la Diana Competencial con puntuaciones (1=Insuficiente, 2=Suficiente, 3=Bien, 4=Excelente) y descriptores para:
- ds1: Comunicación
- ds2: Matemática
- ds3: Digital
- ds4: Social
- ds5: Aprender a aprender
- ds6: Emprendimiento

Formato JSON:
{
  "scores": {"ds1": 3, "ds2": 2, "ds3": 3, "ds4": 4, "ds5": 3, "ds6": 2},
  "descriptors": {
    "ds1": "Descriptor breve sobre Comunicación...",
    "ds2": "Descriptor breve sobre Matemática...",
    "ds3": "Descriptor breve sobre Digital...",
    "ds4": "Descriptor breve sobre Social...",
    "ds5": "Descriptor breve sobre Aprender a aprender...",
    "ds6": "Descriptor breve sobre Emprendimiento..."
  }
}`;

    const files: InlineFile[] = lawDocument ? [lawDocument] : [];

    const raw = await callGemini(systemPrompt, userPrompt, files, {
      onStart: () => setGenerating(true),
      onEnd: () => setGenerating(false),
      onError: msg => toast(msg),
    });

    if (!raw) return;

    const parsed = parseGeminiJson<{ scores: ScoreMap; descriptors: DescriptorMap }>(raw);
    if (!parsed) { toast(t('La IA no devolvió un perfil válido. Vuelve a intentarlo.')); return; }

    if (parsed.scores) {
      const newScores = { ...emptyScores() };
      for (const id of SECTOR_IDS) {
        const v = parsed.scores[id];
        if (typeof v === 'number' && v >= 1 && v <= 4) newScores[id] = v;
      }
      setScores(newScores);
    }

    if (parsed.descriptors) {
      const newDesc = { ...emptyDescriptors() };
      for (const id of SECTOR_IDS) {
        if (typeof parsed.descriptors[id] === 'string') newDesc[id] = parsed.descriptors[id];
      }
      setDescriptors(newDesc);
    }

    setSaved(false);
  }, [student, studentEvals, classes, classId, lawDocument, toast, lang, t]);

  const totalScore = SECTOR_IDS.reduce((acc, id) => acc + (scores[id] ?? 0), 0);
  const maxScore = SECTOR_IDS.length * RINGS;
  const completedSectors = SECTOR_IDS.filter(id => scores[id] > 0).length;

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Diana Competencial')}</h1>
          <p className="pg-sub">{t('Perfil de competencias clave por alumno')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {studentId && (
            <>
              <button
                className="btn-ghost"
                onClick={handleReset}
                style={{ gap: 6 }}
              >
                <RotateCcw size={14} />
                {t('Reiniciar')}
              </button>
              <button
                className="btn-accent"
                onClick={handleSave}
                style={{ gap: 6 }}
              >
                <Save size={14} />
                {t(saved ? 'Guardado ✓' : 'Guardar')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="fgroup" style={{ marginBottom: 0 }}>
          <label className="flabel">{t('Clase')}</label>
          <div style={{ position: 'relative' }}>
            <select
              className="finput"
              value={classId}
              onChange={e => handleClassChange(e.target.value)}
              style={{ appearance: 'none', paddingRight: 36 }}
            >
              <option value="">{t('— Selecciona una clase —')}</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>
              ))}
            </select>
            <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          </div>
        </div>

        <div className="fgroup" style={{ marginBottom: 0 }}>
          <label className="flabel">{t('Alumno')}</label>
          <div style={{ position: 'relative' }}>
            <select
              className="finput"
              value={studentId}
              onChange={e => handleStudentChange(e.target.value)}
              disabled={!classId}
              style={{ appearance: 'none', paddingRight: 36 }}
            >
              <option value="">{t('— Selecciona un alumno —')}</option>
              {classStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          </div>
        </div>
      </div>

      {!studentId ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{t('Selecciona un alumno')}</div>
          <div style={{ fontSize: 13 }}>{t('Elige una clase y un alumno para ver su Diana Competencial')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>
          {/* Left: chart + sector buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Student header */}
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'var(--accent-l)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 800, fontSize: 15, color: 'var(--accent-d)',
                    flexShrink: 0
                  }}>
                    {student?.photo
                      ? <img src={student.photo} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
                      : student?.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                    }
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{student?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {t('{n}/{total} competencias evaluadas', { n: completedSectors, total: SECTOR_IDS.length })}
                      {completedSectors > 0 && ` · ${t('{n}/{max} pts', { n: totalScore, max: maxScore })}`}
                    </div>
                  </div>
                </div>
                <button
                  className="btn-ia"
                  onClick={handleAiSuggest}
                  disabled={generating}
                >
                  {generating ? (
                    <span className="ia-generating">
                      <span className="spin" />
                      {t('Generando...')}
                    </span>
                  ) : (
                    <><Sparkles size={14} />{t('Sugerir perfil con IA')}</>
                  )}
                </button>
              </div>
              {studentEvals.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-3)' }}>
                  {t(studentEvals.length === 1 ? '{n} evaluación disponible' : '{n} evaluaciones disponibles', { n: studentEvals.length })} {t('para análisis')}
                </div>
              )}
            </div>

            {/* SVG Radar Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, textAlign: 'center' }}>
                {t('Haz clic sobre un eje, a la altura del nivel que quieras darle')}
              </div>
              <DianaChart
                scores={scores}
                onSetScore={handleSetScore}
                selectedSector={selectedSector}
                onSelectSector={setSelectedSector}
              />

              {/* Level legend */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[1, 2, 3, 4].map(lvl => (
                  <div key={lvl} style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                    background: LEVEL_COLORS[lvl].bg, color: LEVEL_COLORS[lvl].text,
                    padding: '3px 10px', borderRadius: 99, fontWeight: 700,
                    border: `1px solid ${LEVEL_COLORS[lvl].border}`
                  }}>
                    <span style={{ fontWeight: 900 }}>{lvl}</span> {t(LEVEL_LABELS[lvl])}
                  </div>
                ))}
              </div>
            </div>

            {/* Per-sector level buttons */}
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl">{t('Ajuste por competencia')}</div>
                {selectedSector && (
                  <span style={{ fontSize: 12, color: 'var(--accent-d)', fontWeight: 700 }}>
                    {t('Editando: {name}', { name: t(DIANA_SECTORS.find(s => s.id === selectedSector)?.label ?? '') })}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DIANA_SECTORS.map(s => {
                  const sid = s.id as SectorId;
                  const current = scores[sid];
                  const isActive = selectedSector === sid;
                  return (
                    <div
                      key={sid}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: isActive ? 'var(--accent-l)' : 'var(--surface)',
                        border: `1.5px solid ${isActive ? 'var(--accent-d)' : 'var(--border)'}`,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onClick={() => setSelectedSector(isActive ? null : sid)}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 0 }}>
                        {t(s.label)}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[1, 2, 3, 4].map(lvl => (
                          <button
                            key={lvl}
                            onClick={e => { e.stopPropagation(); handleSetScore(sid, lvl); setSelectedSector(sid); }}
                            style={{
                              width: 30, height: 30, borderRadius: 7, border: 'none',
                              cursor: 'pointer', fontSize: 12, fontWeight: 800,
                              transition: 'all 0.15s',
                              background: current === lvl ? LEVEL_COLORS[lvl].bg : 'white',
                              color: current === lvl ? LEVEL_COLORS[lvl].text : 'var(--text-3)',
                              boxShadow: current === lvl
                                ? `0 0 0 2px ${LEVEL_COLORS[lvl].border}`
                                : '0 0 0 1px var(--border)',
                            }}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                      {current > 0 && (
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                          background: LEVEL_COLORS[current].bg, color: LEVEL_COLORS[current].text,
                          border: `1px solid ${LEVEL_COLORS[current].border}`,
                          flexShrink: 0, minWidth: 60, textAlign: 'center',
                        }}>
                          {t(LEVEL_LABELS[current])}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: descriptors panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 20 }}>
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl">{t('Descriptores')}</div>
                {Object.values(descriptors).some(d => d) && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'var(--accent-l)', color: 'var(--accent-d)', fontWeight: 700 }}>
                    IA
                  </span>
                )}
              </div>
              {generating ? (
                <div className="ia-generating" style={{ padding: '20px 0', justifyContent: 'center' }}>
                  <span className="spin" />
                  {t('Analizando perfil competencial...')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {DIANA_SECTORS.map(s => {
                    const sid = s.id as SectorId;
                    const desc = descriptors[sid];
                    const score = scores[sid];
                    const isActive = selectedSector === sid;
                    return (
                      <div
                        key={sid}
                        style={{
                          padding: '12px 14px', borderRadius: 10,
                          background: isActive ? 'var(--accent-l)' : desc ? 'var(--surface)' : 'transparent',
                          border: `1.5px solid ${isActive ? 'var(--accent-d)' : 'var(--border)'}`,
                          transition: 'all 0.15s', cursor: 'pointer',
                        }}
                        onClick={() => setSelectedSector(isActive ? null : sid)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: desc ? 8 : 0 }}>
                          <span style={{ fontSize: 15 }}>{s.icon}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', flex: 1 }}>{t(s.label)}</span>
                          {score > 0 && (
                            <span style={{
                              fontSize: 10, fontWeight: 900, padding: '2px 8px',
                              borderRadius: 99,
                              background: LEVEL_COLORS[score].bg,
                              color: LEVEL_COLORS[score].text,
                              border: `1px solid ${LEVEL_COLORS[score].border}`,
                            }}>
                              {t('Nv.{n}', { n: score })} · {t(LEVEL_LABELS[score])}
                            </span>
                          )}
                        </div>
                        {desc ? (
                          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: 0 }}>{desc}</p>
                        ) : (
                          <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: 0, fontStyle: 'italic' }}>
                            {t('Sin descriptor. Usa "Sugerir con IA" para generarlo.')}
                          </p>
                        )}
                        {/* Editable descriptor textarea */}
                        {isActive && (
                          <textarea
                            className="finput"
                            value={desc}
                            placeholder={t('Escribe un descriptor para esta competencia...')}
                            onChange={e => setDescriptors(prev => ({ ...prev, [sid]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            rows={3}
                            style={{ marginTop: 8, resize: 'vertical', fontSize: 12.5, lineHeight: 1.5 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary card */}
            {completedSectors > 0 && (
              <div className="card" style={{ padding: '14px 16px' }}>
                <div className="card-hd" style={{ marginBottom: 10 }}>
                  <div className="card-ttl">{t('Resumen')}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-d)' }}>
                    {totalScore}/{maxScore}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {DIANA_SECTORS.filter(s => scores[s.id as SectorId] > 0).map(s => {
                    const sid = s.id as SectorId;
                    const score = scores[sid];
                    const pct = (score / RINGS) * 100;
                    return (
                      <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, width: 12 }}>{s.icon}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t(s.label)}
                        </span>
                        <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: LEVEL_COLORS[score].text }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: LEVEL_COLORS[score].text, width: 14, textAlign: 'center' }}>{score}</span>
                      </div>
                    );
                  })}
                </div>
                {completedSectors < SECTOR_IDS.length && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                    {t((SECTOR_IDS.length - completedSectors) === 1 ? '{n} competencia pendiente' : '{n} competencias pendientes', { n: SECTOR_IDS.length - completedSectors })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
