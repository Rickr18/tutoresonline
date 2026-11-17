import { useNavigate } from 'react-router-dom';
import { Button, Result } from 'antd';

/** 403 (la ruta existe pero es de otro rol) o 404 (la ruta no existe). Se muestra dentro del marco de quien tiene sesión. */
export default function NoEncontrada({ prohibida, inicio }: { prohibida?: boolean; inicio: string }) {
  const ir = useNavigate();
  return (
    <Result status={prohibida ? '403' : '404'}
      title={prohibida ? 'No tienes acceso a esta página' : 'No encontramos esta página'}
      subTitle={prohibida ? 'Esta sección es de otro tipo de cuenta. Si crees que es un error, escribe a soporte.' : 'La dirección no existe o cambió de lugar.'}
      extra={<Button type="primary" onClick={() => ir(inicio, { replace: true })}>Ir a mi inicio</Button>} />
  );
}
