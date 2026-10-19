// The public Hatchable profile has no durable renderer or authenticated spend control.
// Never advertise the experimental in-memory rendering implementation as production-ready.
export const RENDER_TOOL_NAMES = new Set(['render_brand_direction','run_brand_workflow','get_render_job']);
export function renderingAvailable() { return false; }
export function generationHandoff() {
  return {
    mode: 'host_native',
    plugin_rendering_available: false,
    instructions: 'Les trois briefs de rendu sont prêts. Pour créer une image, utiliser l’outil natif de génération d’images de ChatGPT ou de Codex lorsqu’il est disponible. Un prompt seul n’est pas une image; ne pas annoncer de rendu démarré sans appel réel.',
    storage_note: 'Ce serveur ne génère ni ne conserve de planches. La création d’images dépend des capacités de la conversation hôte.'
  };
}
export function requireRendering() { throw new Error('Plugin-side rendering is not enabled on this server. Use the concept-board prompt with the host image-generation tool.'); }
