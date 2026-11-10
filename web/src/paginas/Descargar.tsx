import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Flex, Row, Steps, Typography } from 'antd';
import { Qr, URL_APK, urlDescarga } from '../qr';
import { AMBAR, MARINO } from '../tema';

function dispositivo() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return {
    android: /Android/i.test(ua),
    ios,
    otroNavegadorIos: ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua),
  };
}

const destacada = { borderColor: AMBAR, boxShadow: `0 0 0 1px ${AMBAR}` };

export default function Descargar() {
  const ir = useNavigate();
  const { android, ios, otroNavegadorIos } = dispositivo();
  const telefono = android || ios;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

  const tarjetaAndroid = (
    <Col xs={24} md={12} key="android">
      <Card title="Android" style={{ height: '100%', ...(android ? destacada : {}) }}>
        <Typography.Paragraph>
          Descarga el APK y ábrelo desde las notificaciones o la carpeta Descargas. La primera vez Android pide permiso para instalar apps
          desde el navegador: acéptalo y vuelve a tocar el archivo.
        </Typography.Paragraph>
        <Button type="primary" block size="large" href={URL_APK}>Descargar APK</Button>
      </Card>
    </Col>
  );

  const tarjetaIos = (
    <Col xs={24} md={12} key="ios">
      <Card title="iPhone" style={{ height: '100%', ...(ios ? destacada : {}) }}>
        <Typography.Paragraph>
          En iPhone se usa la versión web, que queda como un ícono en la pantalla de inicio y abre a pantalla completa.
        </Typography.Paragraph>
        {otroNavegadorIos && <Alert type="warning" showIcon title="Abre esta página en Safari para poder agregarla a la pantalla de inicio." style={{ marginBottom: 16 }} />}
        <Steps orientation="vertical" size="small" current={-1} style={{ marginBottom: 16 }} items={[
          { title: 'Abre la página en Safari' },
          { title: 'Toca Compartir', content: 'El cuadro con la flecha hacia arriba.' },
          { title: 'Agregar a pantalla de inicio', content: 'Y luego "Agregar".' },
        ]} />
        <Button block size="large" onClick={() => ir('/')} style={{ background: MARINO, color: '#fff', borderColor: MARINO }}>Abrir TutoresOn-Line</Button>
      </Card>
    </Col>
  );

  return (
    <div className="descarga">
      <header>
        <Link to="/" className="marca">
          <span className="logo">T</span>
          <span className="nombre">Tutores<em>On-Line</em></span>
        </Link>
      </header>
      <Typography.Title level={2} style={{ margin: 0 }}>Lleva TutoresOn-Line en tu teléfono</Typography.Title>

      {!telefono && (
        <Card>
          <Flex gap={24} align="center" wrap>
            <Qr texto={urlDescarga()} tamano={180} />
            <Flex vertical gap={8} style={{ flex: 1, minWidth: 240 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>Escanea con la cámara del teléfono</Typography.Title>
              <Typography.Text type="secondary">
                El mismo código sirve para los dos: en Android descarga la app y en iPhone explica cómo dejar la web en la pantalla de inicio.
              </Typography.Text>
              <Typography.Text copyable className="nums">{urlDescarga()}</Typography.Text>
              {local && <Alert type="warning" showIcon title="Estás en localhost y el teléfono no puede abrir esa dirección. Entra con la IP del PC o con la URL de Render para que el código funcione." />}
            </Flex>
          </Flex>
        </Card>
      )}

      <Row gutter={[16, 16]}>{ios ? [tarjetaIos, tarjetaAndroid] : [tarjetaAndroid, tarjetaIos]}</Row>

      <Typography.Text type="secondary">El soporte y la administración se usan desde la web en un computador.</Typography.Text>
    </div>
  );
}
