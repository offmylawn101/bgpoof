type Context = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => object;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerDownloadTool(
  getResult: () => {
    result?: string;
    name: string;
    width: number;
    height: number;
  } | null,
) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: 'get_cutout_download',
          description:
            'Get the completed transparent PNG download URL and dimensions for the photo currently on screen. Does not upload photos or start processing.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute(input) {
            if (
              !input ||
              typeof input !== 'object' ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw new Error('Expected an empty object.');
            const photo = getResult();
            if (!photo?.result) return { status: 'not_ready' };
            return {
              status: 'ready',
              download_url: photo.result,
              filename: photo.name.replace(/\.[^.]+$/, '') + '-no-bg.png',
              width: photo.width,
              height: photo.height,
              type: 'image/png',
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {
      /* Optional experimental browser API. */
    });
  } catch {
    /* Unsupported or restricted experimental API. */
  }
  return () => lifecycle.abort();
}
