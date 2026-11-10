/* Términos y condiciones (/terminos) y política de tratamiento de datos (/privacidad). Páginas públicas.
   La app móvil las abre en el navegador, así que el texto vive solo aquí. */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Typography } from 'antd';

/** Misma versión que VERSION_TERMINOS en server/src/db.ts (la que se guarda al aceptar al registrarse). */
export const VERSION_LEGAL = '2026-11-10';
const FECHA_LEGAL = '10 de noviembre de 2026';
const CONTACTO = 'soporte@tutores.co';

const { Title, Paragraph, Text } = Typography;

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <Title level={4} style={{ marginTop: 8 }}>{titulo}</Title>
      {children}
    </section>
  );
}

function Pagina({ titulo, otro, children }: { titulo: string; otro: { ruta: string; texto: string }; children: ReactNode }) {
  return (
    <div className="descarga legal">
      <header>
        <Link to="/" className="marca">
          <span className="logo">T</span>
          <span className="nombre">Tutores<em>On-Line</em></span>
        </Link>
      </header>
      <div>
        <Title level={2} style={{ margin: 0 }}>{titulo}</Title>
        <Text type="secondary">Versión {VERSION_LEGAL}, vigente desde el {FECHA_LEGAL}. </Text>
        <Link to={otro.ruta}>{otro.texto}</Link>
      </div>
      <Alert type="info" showIcon
        title="TutoresOn-Line es un prototipo académico. Los pagos son simulados y los datos de contacto son de demostración; este texto no reemplaza la revisión de un abogado." />
      <Card>{children}</Card>
    </div>
  );
}

export function Terminos() {
  return (
    <Pagina titulo="Términos y condiciones" otro={{ ruta: '/privacidad', texto: 'Ver la política de tratamiento de datos' }}>
      <Seccion titulo="1. Qué es TutoresOn-Line">
        <Paragraph>
          TutoresOn-Line es una plataforma que pone en contacto a estudiantes con tutores para sesiones de refuerzo académico, programadas o
          inmediatas. La plataforma verifica a los tutores, cobra el pago, lo retiene hasta que la sesión termina y atiende los reclamos. Los
          tutores son profesionales independientes: no son empleados de la plataforma y responden por el contenido de sus sesiones.
        </Paragraph>
        <Paragraph>Al crear una cuenta aceptas estos términos y la política de tratamiento de datos.</Paragraph>
      </Seccion>

      <Seccion titulo="2. Cuentas">
        <Paragraph>
          Los datos de registro deben ser reales y la contraseña es personal. Si eres menor de edad, solo puedes usar la plataforma con la
          autorización de tu padre, madre o acudiente, que responde por el uso de la cuenta y por los pagos. Los tutores deben completar su perfil
          y pasar la verificación antes de aparecer en las búsquedas.
        </Paragraph>
      </Seccion>

      <Seccion titulo="3. Pagos y comisión">
        <Paragraph>
          El estudiante paga la sesión al reservarla o al pedir un tutor ahora. El dinero queda retenido por la plataforma y se entrega al tutor
          48 horas después de que la sesión termina, si no hay un reclamo abierto. La plataforma descuenta una comisión del 15 % al tutor. El
          precio que ve el estudiante es el precio final de la sesión.
        </Paragraph>
      </Seccion>

      <Seccion titulo="4. Cancelaciones y reembolsos">
        <Paragraph>
          Si el estudiante cancela con más de 24 horas de anticipación recibe el 100 % del pago; entre 24 y 2 horas antes, el 50 %; con menos de
          2 horas, no hay reembolso. Si cancela el tutor, o si nadie acepta la solicitud a tiempo, el estudiante recibe el 100 %. Los reembolsos
          vuelven al mismo medio de pago.
        </Paragraph>
        <Paragraph>
          El derecho de retracto de las ventas a distancia (artículo 47 de la Ley 1480 de 2011) no aplica a una sesión que ya empezó con tu
          acuerdo, pero sí puedes ejercerlo sobre una reserva que aún no ha comenzado, dentro de los cinco días hábiles siguientes al pago, escribiendo a soporte. Cuando
          corresponda, también puedes pedir la reversión del pago según el artículo 51 de la misma ley.
        </Paragraph>
      </Seccion>

      <Seccion titulo="5. Calificaciones y reclamos">
        <Paragraph>
          Solo se califican sesiones finalizadas, y las dos calificaciones se publican juntas o a los 7 días. Si algo salió mal, puedes abrir un
          caso de soporte dentro de las 48 horas siguientes a la sesión. Mientras el caso está abierto el pago sigue retenido. Soporte escucha a
          las dos partes por separado y puede decidir un reembolso total, uno del 50 % o la entrega del pago al tutor; si no logra resolverlo, lo
          decide un administrador.
        </Paragraph>
      </Seccion>

      <Seccion titulo="6. Conducta">
        <Paragraph>
          No se permite acosar o discriminar, compartir datos de contacto para cobrar por fuera de la plataforma, hacer tareas o exámenes por el
          estudiante, ni publicar información falsa. La plataforma puede suspender las cuentas que incumplan estas reglas, con aviso a la persona.
        </Paragraph>
      </Seccion>

      <Seccion titulo="7. Responsabilidad">
        <Paragraph>
          La plataforma responde por el cobro, la retención y los reembolsos, y por atender los reclamos en los plazos indicados. No garantiza
          resultados académicos ni responde por el contenido que el tutor enseña. Las salas virtuales usan un servicio externo de videollamadas.
        </Paragraph>
      </Seccion>

      <Seccion titulo="8. Cambios y ley aplicable">
        <Paragraph>
          Si estos términos cambian, se publica la nueva versión con su fecha y se avisa en la aplicación. Se rigen por las leyes de Colombia,
          en especial el Estatuto del Consumidor (Ley 1480 de 2011). Para cualquier consulta escribe a <Text code>{CONTACTO}</Text>.
        </Paragraph>
      </Seccion>
    </Pagina>
  );
}

export function Privacidad() {
  return (
    <Pagina titulo="Política de tratamiento de datos personales" otro={{ ruta: '/terminos', texto: 'Ver los términos y condiciones' }}>
      <Seccion titulo="1. Responsable">
        <Paragraph>
          TutoresOn-Line, prototipo académico. Correo de contacto: <Text code>{CONTACTO}</Text> (dirección de demostración). Esta política
          cumple la Ley 1581 de 2012 y el Decreto 1377 de 2013.
        </Paragraph>
      </Seccion>

      <Seccion titulo="2. Datos que recogemos">
        <Paragraph>
          De todas las cuentas: nombre, correo, contraseña (guardada cifrada, nadie puede leerla) y tipo de cuenta. De los tutores, además: perfil,
          materias, tarifa, disponibilidad y el soporte de estudios que envían para la verificación. Del uso de la plataforma: sesiones,
          calificaciones, pagos, mensajes y pruebas de los casos de soporte, notificaciones y la hora en que cada persona abre la sala virtual.
          No guardamos el número de la tarjeta ni pedimos datos sensibles.
        </Paragraph>
      </Seccion>

      <Seccion titulo="3. Para qué los usamos">
        <Paragraph>
          Para crear y proteger tu cuenta, conectar estudiantes con tutores, cobrar, retener, pagar y reembolsar, publicar las calificaciones,
          atender los casos de soporte, enviarte avisos sobre tus sesiones y cumplir obligaciones legales y contables. No vendemos tus datos ni
          los usamos para publicidad de terceros.
        </Paragraph>
      </Seccion>

      <Seccion titulo="4. Quién los ve">
        <Paragraph>
          El estudiante y el tutor de una sesión ven el nombre del otro y los datos de esa sesión. El perfil del tutor verificado es visible para
          los estudiantes. El equipo de soporte y los administradores ven lo necesario para atender casos y verificar tutores. En un caso de
          soporte, lo que escribe cada parte solo lo ven esa parte y el equipo.
        </Paragraph>
        <Paragraph>
          Los servidores de la plataforma están en Estados Unidos (Render). Ese proveedor actúa como encargado del tratamiento y solo guarda los
          datos para prestar el servicio.
        </Paragraph>
      </Seccion>

      <Seccion titulo="5. Tus derechos">
        <Paragraph>
          Como titular puedes conocer, actualizar y corregir tus datos; pedir prueba de la autorización que diste; saber cómo se han usado;
          revocar la autorización o pedir que se borren cuando no exista un deber legal de conservarlos; y presentar quejas ante la
          Superintendencia de Industria y Comercio. Consultar tus datos es gratis.
        </Paragraph>
        <Paragraph>
          Para ejercerlos escribe a <Text code>{CONTACTO}</Text> desde el correo de tu cuenta. Las consultas se responden en máximo 10 días
          hábiles y los reclamos en máximo 15 días hábiles, como dicen los artículos 14 y 15 de la Ley 1581 de 2012.
        </Paragraph>
      </Seccion>

      <Seccion titulo="6. Menores de edad">
        <Paragraph>
          Los datos de estudiantes menores de edad se tratan respetando su interés superior y solo con la autorización de su padre, madre o
          acudiente, que puede ejercer los derechos de esta política en su nombre.
        </Paragraph>
      </Seccion>

      <Seccion titulo="7. Seguridad y conservación">
        <Paragraph>
          Las contraseñas se guardan cifradas, la conexión va por HTTPS, las sesiones se cierran al cambiar la contraseña y los archivos de los
          casos solo los abren las personas autorizadas. Conservamos los datos mientras la cuenta esté activa. Los registros de pagos y sesiones
          se guardan el tiempo que exige la ley contable y tributaria.
        </Paragraph>
      </Seccion>

      <Seccion titulo="8. Autorización y vigencia">
        <Paragraph>
          Al crear tu cuenta marcas la casilla de aceptación y la plataforma guarda la fecha y la versión de esta política. Si la política cambia,
          se publica la nueva versión y se te avisa. Esta versión rige desde el {FECHA_LEGAL}.
        </Paragraph>
      </Seccion>
    </Pagina>
  );
}
