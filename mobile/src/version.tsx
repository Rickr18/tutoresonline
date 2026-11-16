/*
 * Aviso de versión nueva del APK. Al abrir la app se consulta GET /api/version (el último APK publicado en GitHub Releases);
 * si la versión instalada es más vieja, se ofrece descargar la nueva. "Más tarde" lo esconde hasta la siguiente versión.
 * Si la instalada está por debajo de la mínima (VERSION_APP_MINIMA en el servidor), el aviso no se puede cerrar.
 * Solo en Android: la PWA de iPhone se actualiza sola desde /app/.
 */
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api } from './api';
import { Boton } from './ui';
import { e } from './tema';

const CLAVE = 'tutoresonline.version-descartada';
export const VERSION_INSTALADA = Constants.expoConfig?.version ?? '0.0.0';

interface VersionPublicada { ultima: string | null; minima: string | null; publicada: string | null; url: string }

/** Compara "1.4.0" con "1.10.2" parte por parte: negativo si a es más vieja. */
export function compararVersiones(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export function AvisoVersion() {
  const [descartada, setDescartada] = useState<string | null | undefined>(undefined);
  const { data } = useQuery({
    queryKey: ['version'], queryFn: () => api<VersionPublicada>('/version'),
    enabled: Platform.OS === 'android', staleTime: Infinity, retry: false,
  });
  useEffect(() => { AsyncStorage.getItem(CLAVE).then(setDescartada).catch(() => setDescartada(null)); }, []);

  if (!data?.ultima || descartada === undefined) return null;
  const obligatoria = !!data.minima && compararVersiones(VERSION_INSTALADA, data.minima) < 0;
  const hayNueva = compararVersiones(VERSION_INSTALADA, data.ultima) < 0;
  if (!obligatoria && (!hayNueva || descartada === data.ultima)) return null;

  const despues = () => { setDescartada(data.ultima); AsyncStorage.setItem(CLAVE, data.ultima!).catch(() => {}); };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={obligatoria ? () => {} : despues}>
      <View style={{ flex: 1, backgroundColor: 'rgba(12,24,48,.55)', justifyContent: 'center', padding: 22 }}>
        <View style={[e.tarjeta, { gap: 12 }]} accessibilityRole="alert">
          <Text style={e.h2}>{obligatoria ? 'Actualiza la app para seguir' : 'Hay una versión nueva'}</Text>
          <Text style={e.texto}>
            Tienes la versión {VERSION_INSTALADA} y ya está disponible la {data.ultima}.
            {obligatoria ? ' Esta versión ya no funciona con el servidor.' : ''} Descárgala e instálala encima de la que tienes: no pierdes tu cuenta ni tus sesiones.
          </Text>
          <Boton texto={`Descargar la versión ${data.ultima}`} alPresionar={() => { Linking.openURL(data.url).catch(() => {}); }} />
          {!obligatoria && <Boton texto="Más tarde" variante="fantasma" alPresionar={despues} />}
        </View>
      </View>
    </Modal>
  );
}
