// La forma canónica de un correo, solo para compararlo con la lista FUNDADORES (revisión del 5-11-2026): la lista la
// escribe el dueño a mano y Google devuelve el correo tal como está registrado. En Gmail, «nombre.apellido», «nombreapellido»,
// «nombre.apellido+aula» y «@googlemail.com» son la misma cuenta. No se usa para buscar compras en Lemon Squeezy.
export function correoCanonico(correo) {
  const [usuario = '', dominio = ''] = String(correo ?? '').trim().toLowerCase().split('@');
  if (!usuario || !dominio) return '';
  const sinEtiqueta = usuario.split('+')[0];
  if (dominio === 'gmail.com' || dominio === 'googlemail.com') return `${sinEtiqueta.replace(/\./g, '')}@gmail.com`;
  return `${sinEtiqueta}@${dominio}`;
}
