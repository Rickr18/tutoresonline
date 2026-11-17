import type { ThemeConfig } from 'antd';
import { color, radio } from './tokens';

/** Tema de Ant Design con los tokens de la marca: ámbar para la acción principal y marino para el resto. */
export const MARINO = color.marino;
export const AMBAR = color.ambar;

export const temaAntd: ThemeConfig = {
  token: {
    colorPrimary: color.ambar,
    colorLink: '#1d3a66',
    colorText: color.tinta,
    colorTextSecondary: color.tenue,
    colorBorderSecondary: color.linea,
    colorSuccess: color.verde,
    colorError: color.rojo,
    colorBgLayout: color.fondo,
    borderRadius: radio.control,
    borderRadiusLG: radio.tarjeta,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 15,
  },
  components: {
    // Texto oscuro sobre ámbar: el blanco no tiene contraste suficiente.
    Button: { primaryColor: color.ambarTinta, fontWeight: 600, primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
    Card: { borderRadiusLG: radio.tarjeta },
    Table: { headerBg: '#f7f9fc', headerColor: color.tenue, rowHoverBg: '#fafbfd' },
    Segmented: { itemSelectedColor: color.marino },
    Layout: { headerBg: color.marino, headerHeight: 62, headerPadding: 0, bodyBg: color.fondo, siderBg: color.marino },
    Menu: {
      darkItemBg: color.marino, darkPopupBg: color.marino, darkSubMenuItemBg: color.marino,
      darkItemColor: '#c4cfe0', darkItemHoverColor: '#ffffff', darkItemSelectedColor: '#ffffff', darkItemSelectedBg: color.marinoSuave,
      darkItemHoverBg: color.marinoSuave,
    },
    Rate: { starColor: color.ambar },
  },
};
