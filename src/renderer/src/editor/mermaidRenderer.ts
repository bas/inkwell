type ColorMode = 'light' | 'dark';
type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<MermaidApi> | undefined;
let initializedMode: ColorMode | undefined;
let renderSequence = 0;

function getMermaidTheme(mode: ColorMode): 'default' | 'dark' {
  return mode === 'dark' ? 'dark' : 'default';
}

async function loadMermaid(mode: ColorMode): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((module) => module.default);
  }

  const mermaid = await mermaidPromise;
  if (initializedMode !== mode) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: getMermaidTheme(mode),
      fontFamily: 'inherit',
      logLevel: 'error',
    });
    initializedMode = mode;
  }
  return mermaid;
}

export function getCurrentMermaidColorMode(): ColorMode {
  return document.documentElement.getAttribute('data-color-mode') === 'dark' ? 'dark' : 'light';
}

export async function renderMermaidSvg(code: string, mode: ColorMode): Promise<string> {
  const mermaid = await loadMermaid(mode);
  await mermaid.parse(code);
  const { svg } = await mermaid.render(`inkwell-mermaid-${++renderSequence}`, code);
  return svg;
}
