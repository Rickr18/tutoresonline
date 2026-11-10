/* Términos y política de datos: los textos viven en la web (/terminos y /privacidad) y la app los abre en el navegador. */

import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { almacen } from './api';
import { C, e } from './tema';

export function abrirLegal(pagina: 'terminos' | 'privacidad') {
  Linking.openURL(`${almacen.servidor()}/${pagina}`).catch(() => {});
}

const enlace = { color: C.marino, fontWeight: '700' } as const;

/** Casilla obligatoria al crear la cuenta (autorización previa, expresa e informada de la Ley 1581 de 2012). */
export function CasillaTerminos({ marcada, cambiar }: { marcada: boolean; cambiar: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Pressable onPress={() => cambiar(!marcada)} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }}
        accessibilityLabel="Acepto los términos y la política de privacidad" hitSlop={8}>
        <Ionicons name={marcada ? 'checkbox' : 'square-outline'} size={24} color={marcada ? C.marino : '#7a8699'} />
      </Pressable>
      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: C.tinta }}>
        Acepto los <Text style={enlace} onPress={() => abrirLegal('terminos')} accessibilityRole="link">Términos y condiciones</Text> y
        autorizo el tratamiento de mis datos según la <Text style={enlace} onPress={() => abrirLegal('privacidad')} accessibilityRole="link">Política de privacidad</Text>.
        Si soy menor de edad, cuento con la autorización de mi padre, madre o acudiente.
      </Text>
    </View>
  );
}

export function EnlacesLegales() {
  return (
    <Text style={[e.pequeno, { textAlign: 'center' }]}>
      <Text style={enlace} onPress={() => abrirLegal('terminos')} accessibilityRole="link">Términos y condiciones</Text>
      {'  ·  '}
      <Text style={enlace} onPress={() => abrirLegal('privacidad')} accessibilityRole="link">Política de privacidad</Text>
    </Text>
  );
}
