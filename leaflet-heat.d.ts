import * as L from 'leaflet';

declare module 'leaflet.heat' {
  export interface HeatLayerOptions extends L.LayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  export type HeatLatLngTuple = [number, number, number?];

  export class HeatLayer extends L.Layer {
    constructor(latlngs: HeatLatLngTuple[], options?: HeatLayerOptions);
    setLatLngs(latlngs: HeatLatLngTuple[]): this;
    addLatLng(latlng: HeatLatLngTuple): this;
    setOptions(options: HeatLayerOptions): this;
    getBounds(): L.LatLngBounds;
    redraw(): this;
  }
}
