type ColorMode = 'light' | 'dark';
type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<MermaidApi> | undefined;
let initializedMode: ColorMode | undefined;
let renderSequence = 0;

function isAllowedSvgReference(value: string): boolean {
  const normalized = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127 && !/\s/.test(character) && character !== '\\';
    })
    .join('')
    .toLowerCase();
  return normalized.startsWith('#');
}

function sanitizeMermaidSvg(svg: string): string {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const parserError = document.querySelector('parsererror');
  if (parserError) throw new Error('Mermaid returned invalid SVG.');

  document.querySelectorAll('script, foreignObject').forEach((element) => element.remove());
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith('on') ||
        ((name === 'href' || name.endsWith(':href')) && !isAllowedSvgReference(attribute.value))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return document.documentElement.outerHTML;
}

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
  return sanitizeMermaidSvg(svg);
}
