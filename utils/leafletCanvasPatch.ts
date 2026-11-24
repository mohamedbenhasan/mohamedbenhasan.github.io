import L from 'leaflet';

let patched = false;

/**
 * Guards Leaflet's L.Canvas renderer against unmount/StrictMode race conditions
 * where a pending animationFrame or layer cleanup triggers `_redraw`/`_clear`
 * after `_destroyContainer` has already deleted `_ctx` and `_container`.
 */
export function ensureLeafletCanvasSafety(): void {
  if (patched) return;
  patched = true;

  const proto = L.Canvas.prototype as unknown as {
    _vruSafetyPatched?: boolean;
    _clear?: () => void;
    _draw?: () => void;
    _redraw?: () => void;
    _update?: () => void;
    _destroyContainer?: () => void;
    _ctx?: CanvasRenderingContext2D | null;
    _container?: HTMLCanvasElement | null;
    _map?: L.Map | null;
    _redrawRequest?: number | null;
  };

  if (!proto || proto._vruSafetyPatched) return;
  proto._vruSafetyPatched = true;

  const origClear = proto._clear;
  const origDraw = proto._draw;
  const origRedraw = proto._redraw;
  const origUpdate = proto._update;
  const origDestroyContainer = proto._destroyContainer;

  if (typeof origRedraw === 'function') {
    proto._redraw = function (this: typeof proto) {
      if (!this._ctx || !this._container || !this._map) {
        this._redrawRequest = null;
        return;
      }
      return origRedraw.call(this);
    };
  }

  if (typeof origClear === 'function') {
    proto._clear = function (this: typeof proto) {
      if (!this._ctx || !this._container) {
        return;
      }
      return origClear.call(this);
    };
  }

  if (typeof origDraw === 'function') {
    proto._draw = function (this: typeof proto) {
      if (!this._ctx || !this._container) {
        return;
      }
      return origDraw.call(this);
    };
  }

  if (typeof origUpdate === 'function') {
    proto._update = function (this: typeof proto) {
      if (!this._map || !this._container || !this._ctx) {
        return;
      }
      return origUpdate.call(this);
    };
  }

  if (typeof origDestroyContainer === 'function') {
    proto._destroyContainer = function (this: typeof proto) {
      if (this._redrawRequest != null) {
        L.Util.cancelAnimFrame(this._redrawRequest);
        this._redrawRequest = null;
      }
      return origDestroyContainer.call(this);
    };
  }
}
