/**
 * WebContents ids of trusted first-party windows (main + sprite overlay).
 * Core bus events are broadcast ONLY to these — never to sandboxed
 * third-party plugin windows, which receive events solely through the
 * permission-filtered forwarding in ThirdPartyPluginHost.
 */
export const trustedContents = new Set<number>();
