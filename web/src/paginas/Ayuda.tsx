/* Preguntas frecuentes (/ayuda). Página pública; la app móvil la abre en el navegador.
   Las cifras siguen las reglas de negocio del servidor (RN-02 a RN-09). */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, Collapse, Typography } from 'antd';
import { EncabezadoPublico, PiePublico } from '../publica';

const { Title, Paragraph } = Typography;

type Pregunta = { p: string; r: ReactNode };

const GRUPOS: { titulo: string; preguntas: Pregunta[] }[] = [
  {
    titulo: 'Para estudiantes',
    preguntas: [
      { p: '¿Cómo reservo una sesión?', r: 'Busca por materia o por nombre, entra al perfil del tutor, elige una hora libre de su agenda, escribe el tema y paga. El tutor tiene 12 horas para aceptar; si no responde, la reserva se cancela y te devolvemos todo.' },
      { p: '¿Qué es "Tutor ahora"?', r: 'Eliges la materia y la duración, pagas y tu solicitud llega a todos los tutores en línea de esa materia. El primero que acepte se queda con la sesión. Si nadie acepta en 45 segundos, no se hace ningún cobro.' },
      { p: '¿Cuándo recibe el tutor mi pago?', r: 'El dinero queda retenido por la plataforma y se entrega al tutor 48 horas después de que termina la sesión, siempre que no haya un reclamo abierto. Si algo sale mal, el pago sigue protegido mientras soporte revisa el caso.' },
      { p: '¿Puedo cancelar? ¿Me devuelven el dinero?', r: 'Sí. Con más de 24 horas de anticipación te devolvemos el 100 %; entre 24 y 2 horas antes, el 50 %; con menos de 2 horas no hay reembolso. Si cancela el tutor, recibes el 100 %.' },
      { p: '¿Me avisan antes de la sesión?', r: 'Sí. Una hora antes de cada sesión confirmada te llega un recordatorio en la aplicación, a ti y al tutor.' },
      { p: '¿Cómo funcionan las calificaciones?', r: 'Solo se califican sesiones finalizadas. Las dos calificaciones se publican al mismo tiempo, cuando ambos califican o a los 7 días, para que ninguna influya en la otra.' },
      { p: 'La sesión salió mal. ¿Qué hago?', r: 'Desde el detalle de la sesión abre un caso de soporte dentro de las 48 horas siguientes. Puedes escribir y adjuntar pruebas (fotos o PDF). Soporte habla con cada parte por separado y decide un reembolso total, uno del 50 % o el pago al tutor; si hace falta, lo decide un administrador.' },
    ],
  },
  {
    titulo: 'Para tutores',
    preguntas: [
      { p: '¿Cómo me verifico?', r: 'Después de registrarte completa tu perfil (presentación, tarifa, materias y disponibilidad), adjunta el soporte de tus estudios y envíalo a verificación. Un administrador lo revisa; cuando lo aprueba, apareces en las búsquedas.' },
      { p: '¿Cuánto cobra la plataforma?', r: 'Una comisión del 15 % de cada sesión. En Ingresos ves el valor de cada sesión, la comisión y lo que te queda.' },
      { p: '¿Cuándo recibo el dinero?', r: 'A las 48 horas de terminar la sesión, si no hay un reclamo abierto. Mientras tanto aparece como pago retenido.' },
      { p: '¿Cómo recibo solicitudes de "Tutor ahora"?', r: 'Activa el interruptor de "En línea". Te llegan las solicitudes de tus materias y tienes 45 segundos para aceptarlas; la sesión es del primer tutor que acepta.' },
      { p: 'Mi materia no está en la lista.', r: 'Desde tu perfil puedes pedir una materia nueva (hasta 3 pedidos pendientes). Un administrador la aprueba o te explica por qué no.' },
    ],
  },
  {
    titulo: 'Cuenta y aplicación',
    preguntas: [
      { p: 'Olvidé mi contraseña.', r: <>En la pantalla de ingreso toca "¿Olvidaste tu contraseña?". Te enviamos un código de 6 dígitos que vence en 15 minutos. En esta demostración el código aparece en pantalla porque no se envían correos.</> },
      { p: '¿Hay aplicación para el teléfono?', r: <>En Android puedes instalar el APK desde <Link to="/descargar">Descargar</Link>. En iPhone abre la página en Safari, toca Compartir y luego "Agregar a inicio"; queda como una app con su ícono.</> },
      { p: '¿Qué hacen con mis datos?', r: <>Los usamos solo para prestar el servicio. Lee la <Link to="/privacidad">política de tratamiento de datos</Link> y los <Link to="/terminos">términos y condiciones</Link>. Para consultar, corregir o borrar tus datos escribe a soporte@tutores.co.</> },
    ],
  },
];

export default function Ayuda() {
  return (
    <div className="descarga legal">
      <EncabezadoPublico />
      <div>
        <Title level={2} style={{ margin: 0 }}>Preguntas frecuentes</Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>Lo que más nos preguntan sobre reservas, pagos, reembolsos y la aplicación.</Paragraph>
      </div>
      {GRUPOS.map((g) => (
        <Card key={g.titulo} title={g.titulo} styles={{ body: { padding: 0 } }}>
          <Collapse ghost className="preguntas" items={g.preguntas.map((x, i) => ({ key: i, label: x.p, children: <Paragraph style={{ margin: 0 }}>{x.r}</Paragraph> }))} />
        </Card>
      ))}
      <PiePublico />
    </div>
  );
}
