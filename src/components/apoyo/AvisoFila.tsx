/**
 * Un aviso de seguimiento de PT y AL (ver `lib/inicioApoyo.ts`), con el botón
 * que lleva a resolverlo. Sale en el Inicio, con el nombre del alumno, y en la
 * página de cada alumno, sin él.
 */
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n';
import { nombreDePila } from '../../lib/utils';
import type { Aviso } from '../../lib/inicioApoyo';
import type { PestanaAlumno } from '../../lib/apoyoNav';
import type { AlumnoApoyo, GrupoApoyo } from '../../types/apoyo';

export function AvisoFila({ aviso, diaCorto, enSuPagina, onRegistrar, onAlumno }: {
  aviso: Aviso;
  diaCorto: (fecha: string) => string;
  /** En la página del alumno no se repite su nombre. */
  enSuPagina?: boolean;
  onRegistrar: (g: GrupoApoyo, fecha: string) => void;
  /** Lleva a lo del alumno, en esa pestaña de su página. */
  onAlumno: (a: AlumnoApoyo, pestana: PestanaAlumno) => void;
}) {
  const { t } = useI18n();
  const fila = (nivel: 'warn' | 'danger' | 'info', titulo: string | null, texto: React.ReactNode, boton: string, accion: () => void) => (
    <li className="home-alert">
      <span className={`home-alert-dot ${nivel}`} />
      <span className="ap-lista-txt">
        {titulo && <strong>{titulo}</strong>}
        <span className={titulo ? 'ap-meta' : 'al-aviso-txt'}>{texto}</span>
      </span>
      <button className="home-link" onClick={accion}>{boton} <ArrowRight size={13} /></button>
    </li>
  );
  const nombre = (a: AlumnoApoyo) => (enSuPagina ? null : nombreDePila(a.nombre));
  switch (aviso.tipo) {
    case 'informes': {
      const [primero] = aviso.alumnos;
      if (enSuPagina) {
        return fila('warn', t('Se acaba el {n}º trimestre', { n: aviso.trimestre }), t('Falta su informe trimestral.'),
          t('Documentos'), () => onAlumno(primero, 'documentos'));
      }
      // Cada nombre lleva a los documentos de ese alumno
      const nombres = aviso.alumnos.map((a, i) => (
        <span key={a.id}>
          {i > 0 && ', '}
          <button type="button" className="ap-enlace" onClick={() => onAlumno(a, 'documentos')}>{nombreDePila(a.nombre)}</button>
        </span>
      ));
      return fila('warn', t('Se acaba el {n}º trimestre', { n: aviso.trimestre }),
        <>{t('Falta el informe de:')} {nombres}.</>,
        t('Informes'), () => onAlumno(primero, 'documentos'));
    }
    case 'sin-registrar':
      return fila('warn', t('{grupo}: sin registrar', { grupo: aviso.grupo.nombre }), diaCorto(aviso.fecha),
        t('Registrar'), () => onRegistrar(aviso.grupo, aviso.fecha));
    case 'atascado':
      return fila('danger', nombre(aviso.alumno),
        t('«{objetivo}»: {n} veces seguidas sin conseguirlo. Quizá convenga ajustarlo o cambiar el apoyo.', { objetivo: aviso.objetivo.texto, n: aviso.veces }),
        t('Programa'), () => onAlumno(aviso.alumno, 'programa'));
    case 'sin-trabajar':
      return fila('info', nombre(aviso.alumno),
        t('«{objetivo}» no se ha trabajado en sus {n} sesiones de este trimestre.', { objetivo: aviso.objetivo.texto, n: aviso.sesiones }),
        t('Programa'), () => onAlumno(aviso.alumno, 'programa'));
    case 'sin-objetivos':
      return fila('info', nombre(aviso.alumno),
        t('No tiene objetivos para el {n}º trimestre.', { n: aviso.trimestre }),
        t('Programa'), () => onAlumno(aviso.alumno, 'programa'));
    case 'sin-grupo':
      return fila('info', nombre(aviso.alumno), t('No está en ningún grupo de apoyo.'),
        t('Grupos'), () => onAlumno(aviso.alumno, 'datos'));
  }
}
