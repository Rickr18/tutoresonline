import type { ThemeConfig } from 'antd';

/** Tema de Ant Design con los colores de la marca: ámbar para la acción principal y marino para el resto. */
export const MARINO = '#12233f';
export const AMBAR = '#f2a33a';

export const temaAntd: ThemeConfig = {
  token: {
    colorPrimary: AMBAR,
    colorLink: '#1d3a66',
    colorText: '#1a2433',
    colorTextSecondary: '#5f6b7c',
    colorBorderSecondary: '#e2e7ee',
    colorSuccess: '#1c8c7c',
    colorError: '#c0392b',
    borderRadius: 10,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 15,
  },
  components: {
    // Texto oscuro sobre ámbar: el blanco no tiene contraste suficiente.
    Button: { primaryColor: '#2a1c02', fontWeight: 600, primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
    Table: { headerBg: '#f7f9fc', headerColor: '#5f6b7c', rowHoverBg: '#fafbfd' },
    Segmented: { itemSelectedColor: MARINO },
    Layout: { headerBg: MARINO, headerHeight: 62, headerPadding: 0, bodyBg: '#f4f6f9' },
    Menu: {
      darkItemBg: MARINO, darkPopupBg: MARINO, darkSubMenuItemBg: MARINO,
      darkItemColor: '#c4cfe0', darkItemHoverColor: '#ffffff', darkItemSelectedColor: '#ffffff', darkItemSelectedBg: 'rgba(255, 255, 255, .09)',
      horizontalLineHeight: '62px', itemPaddingInline: 12,
    },
    Rate: { starColor: AMBAR },
  },
};
