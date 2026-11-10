import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, Checkbox, Col, Flex, Form, Input, InputNumber, Row, Segmented, Space, Typography, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { api, type Modalidad, type Tutor } from '../../api';
import { useSesion } from '../../sesion';
import { Cabecera, useMaterias } from '../../comunes';
import { Alerta, Campo, Insignia, mensajeDe } from '../../ui';
import { dinero, MODALIDAD, VERIFICACION } from '../../formato';

export default function Perfil() {
  const { usuario, refrescar, avisar } = useSesion();
  const t = usuario?.tutor;
  const materias = useMaterias();
  const [bio, setBio] = useState(t?.bio ?? '');
  const [tarifa, setTarifa] = useState<number | null>(t?.tarifaHora || null);
  const [modalidad, setModalidad] = useState<Modalidad>(t?.modalidad ?? 'VIRTUAL');
  const [ciudad, setCiudad] = useState(t?.ciudad ?? '');
  const [elegidas, setElegidas] = useState<number[]>(t?.materias.map((m) => m.id) ?? []);
  const [documento, setDocumento] = useState<string | null>(null);
  // Qué botón envió el formulario: se lee al terminar la validación.
  const enviarTambien = useRef(false);

  const guardar = useMutation({
    mutationFn: (enviar: boolean) => api<Tutor>('/tutor/perfil', {
      bio: bio.trim(), tarifaHora: Number(tarifa), modalidad, ciudad: ciudad.trim(), materias: elegidas,
      ...(documento ? { documento } : {}), enviar,
    }, 'PUT'),
    onSuccess: async (_r, enviar) => {
      await refrescar();
      setDocumento(null);
      avisar(enviar ? 'Perfil enviado a verificación' : 'Cambios guardados', 'bien',
        enviar ? 'Te avisamos cuando un administrador lo revise.' : undefined);
    },
  });

  if (!t) return null;
  const v = VERIFICACION[t.verificacion ?? 'INCOMPLETO'];
  const puedeEnviar = t.verificacion === 'INCOMPLETO' || t.verificacion === 'RECHAZADO';
  const soporte = documento ?? t.documento;

  return (
    <div style={{ maxWidth: 760 }}>
      <Cabecera titulo="Mi perfil de tutor" detalle="Lo que escribas aquí es lo que ven los estudiantes al buscarte.">
        <Insignia tono={v.tono}>{v.texto}</Insignia>
      </Cabecera>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {t.verificacion === 'RECHAZADO' && <Alerta><b>El administrador rechazó tu perfil</b>{t.motivoRechazo}</Alerta>}
        {t.verificacion === 'PENDIENTE' && <Alerta tono="espera">Tu perfil está en revisión. Puedes seguir editando; los cambios se guardan sin perder tu turno.</Alerta>}

        <Card>
          <Form layout="vertical" className="forma" onFinish={() => guardar.mutate(enviarTambien.current)}>
            <Campo etiqueta="Presentación" id="perfil-bio" ayuda={`${bio.trim().length} de 600 caracteres (mínimo 20).`}>
              <Input.TextArea id="perfil-bio" value={bio} onChange={(e) => setBio(e.target.value)} required minLength={20} maxLength={600} rows={5}
                placeholder="Tu formación, experiencia y cómo trabajas con los estudiantes" />
            </Campo>
            <Row gutter={14}>
              <Col xs={24} sm={12}>
                <Campo etiqueta="Tarifa por hora (COP)" id="perfil-tarifa"
                  ayuda={tarifa ? `Recibes ${dinero(tarifa * 0.85)} por hora después de la comisión del 15 %.` : 'Entre $10.000 y $500.000.'}>
                  <InputNumber id="perfil-tarifa" min={10000} max={500000} step={1000} value={tarifa} onChange={setTarifa} required style={{ width: '100%' }} />
                </Campo>
              </Col>
              <Col xs={24} sm={12}>
                <Campo etiqueta="Ciudad" id="perfil-ciudad">
                  <Input id="perfil-ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} required minLength={2} maxLength={60} />
                </Campo>
              </Col>
            </Row>
            <Campo etiqueta="Modalidad">
              <Segmented block value={modalidad} onChange={(m) => setModalidad(m as Modalidad)}
                options={(['VIRTUAL', 'PRESENCIAL', 'AMBAS'] as const).map((m) => ({ value: m, label: MODALIDAD[m] }))} />
            </Campo>
            <Campo etiqueta="Materias que enseñas" ayuda={`${elegidas.length} de 6 como máximo.`}>
              <Checkbox.Group className="chips eleccion" value={elegidas} onChange={(v) => setElegidas((v as number[]).slice(0, 6))}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 4px' }}
                options={(materias.data ?? []).map((m) => ({
                  value: m.id, label: m.nombre, disabled: elegidas.length >= 6 && !elegidas.includes(m.id),
                }))} />
            </Campo>
            <Campo etiqueta="Soporte de estudios"
              ayuda={`${soporte ? `Archivo actual: ${soporte}. ` : ''}Diploma, certificado o carné en PDF o imagen. En el prototipo solo se guarda el nombre del archivo.`}>
              <Upload accept=".pdf,.jpg,.jpeg,.png" maxCount={1} showUploadList={false}
                beforeUpload={(archivo) => { setDocumento(archivo.name); return false; }}>
                <Button icon={<UploadOutlined />}>{documento ? `Elegido: ${documento}` : 'Elegir archivo'}</Button>
              </Upload>
            </Campo>
            {guardar.isError && <Alerta>{mensajeDe(guardar.error)}</Alerta>}
            <Flex gap={10} justify="flex-end" wrap>
              <Button htmlType="submit" disabled={elegidas.length === 0} loading={guardar.isPending && !guardar.variables}
                onClick={() => { enviarTambien.current = false; }}>Guardar cambios</Button>
              {puedeEnviar && (
                <Button type="primary" htmlType="submit" disabled={elegidas.length === 0} loading={guardar.isPending && guardar.variables}
                  onClick={() => { enviarTambien.current = true; }}>
                  Guardar y enviar a verificación
                </Button>
              )}
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>Los cambios se publican de inmediato si tu perfil ya está aprobado.</Typography.Text>
          </Form>
        </Card>
      </Space>
    </div>
  );
}
