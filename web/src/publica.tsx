/* Piezas comunes de las páginas públicas (inicio, ayuda, términos y privacidad): encabezado con la marca y pie con enlaces. */

import { Link, useNavigate } from 'react-router-dom';
import { Button, Flex, Typography } from 'antd';

export function Marca({ clara }: { clara?: boolean }) {
  return (
    <Link to="/" className={`marca${clara ? ' clara' : ''}`}>
      <span className="logo">T</span>
      <span className="nombre">Tutores<em>On-Line</em></span>
    </Link>
  );
}

export function EncabezadoPublico({ clara }: { clara?: boolean }) {
  const ir = useNavigate();
  return (
    <header className={`encabezado-publico${clara ? ' clara' : ''}`}>
      <Marca clara={clara} />
      <Flex gap={8} align="center" wrap>
        <Link to="/ayuda" className="enlace-ayuda">Ayuda</Link>
        <Button ghost={clara} onClick={() => ir('/ingresar')}>Ingresar</Button>
        <Button type="primary" onClick={() => ir('/ingresar?registro=1')}>Crear cuenta</Button>
      </Flex>
    </header>
  );
}

export function PiePublico() {
  return (
    <footer className="pie-publico">
      <Flex gap="8px 18px" wrap justify="center">
        <Link to="/ayuda">Preguntas frecuentes</Link>
        <Link to="/terminos">Términos y condiciones</Link>
        <Link to="/privacidad">Política de privacidad</Link>
        <Link to="/descargar">Descargar la app</Link>
      </Flex>
      <Typography.Text type="secondary">TutoresOn-Line · Prototipo académico de Gestión de Proyectos Tecnológicos</Typography.Text>
    </footer>
  );
}
