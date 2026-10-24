import test from 'node:test';
import assert from 'node:assert/strict';
import { exploreGraph, generateDirections, coachDecision, critiqueImageMetrics } from '../lib/core.js';
import { loadGraph } from '../lib/data.js';

const brief = {
  name: '27PM', sector: 'Studio québécois', promise: 'Rendre les offres complexes claires.',
  must_avoid: ['Ne pas modifier les textes exacts « 27PM » et « 27:00 ».'],
  design_context: {
    task: 'Composer une page d’accueil, pas une planche de logos.',
    message: 'Conserver « 27PM », « 27:00 » et « Du concret, bien pensé. » exactement.',
    medium: 'Page web responsive et carte imprimée',
    final_size: 'Bureau 1440 × 900 px; mobile 390 × 844 px; symbole 24 px; carte 3,5 × 2 po.',
    cultural_context: 'Français du Québec; noir, blanc et vermillon.'
  }
};
const metrics = { foreground_occupancy: .13, centroid: { x: .5, y: .5 }, balance: .99,
  saliency_concentration: 1, edge_density: .006, contrast: .33, small_size_stability: .97, entropy: .11 };

for (const query of ['IBM', 'NASA', 'nasa-worm', 'brand:ibm-8-bar']) {
  for (const limit of [20, 25, 30]) {
    test(`graph retains ${query} before one-hop neighbours at limit ${limit}`, async () => {
      const result = await exploreGraph(query, limit);
      const expected = query.toLowerCase().includes('ibm') ? 'brand:ibm-8-bar' : 'brand:nasa-worm';
      assert.ok(result.nodes.some(node => node.id === expected));
      assert.ok(result.nodes[0].is_match);
      const firstNeighbour = result.nodes.findIndex(node => !node.is_match);
      if (firstNeighbour >= 0) assert.ok(result.nodes.slice(firstNeighbour).every(node => !node.is_match));
      const keep = new Set(result.nodes.map(node => node.id));
      assert.ok(result.edges.every(edge => keep.has(edge.source) && keep.has(edge.target)));
      assert.ok(result.nodes.length <= limit);
      assert.equal(result.meta.context_hops, 1);
      const graph = await loadGraph(), seeds = new Set(result.nodes.filter(node => node.is_match).map(node => node.id));
      const adjacent = new Set(graph.edges.flatMap(edge => seeds.has(edge.source) ? [edge.target] : seeds.has(edge.target) ? [edge.source] : []));
      assert.ok(result.nodes.every(node => node.is_match || adjacent.has(node.id)));
      assert.deepEqual(await exploreGraph(query, limit), result);
    });
  }
}
for (const query of ['zzqv-inexistant-27pm-qa-20261024', '!!!', '🪷']) {
  test(`graph does not disguise an unmatched query: ${query}`, async () => {
    const result = await exploreGraph(query, 20);
    assert.deepEqual(result.nodes, []);
    assert.deepEqual(result.edges, []);
    assert.equal(result.meta.matched_count, 0);
    assert.equal(result.meta.no_matches, true);
  });
}
test('empty graph query remains browsable', async () => {
  const result = await exploreGraph('', 20);
  assert.equal(result.nodes.length, 20);
});
test('each image prompt preserves exact content and applies every declared medium and size', async () => {
  const result = await generateDirections(brief);
  for (const route of result.routes) {
    const prompt = route.concept_board_prompt;
    for (const text of ['27PM', '27:00', 'Du concret, bien pensé.', '1440 × 900 px', '390 × 844 px', '3,5 × 2 po', 'vermillon']) assert.ok(prompt.includes(text), text);
    assert.doesNotMatch(prompt, /abstract placeholder glyphs|Create one square concept board|Use placeholder text where needed/);
    assert.match(prompt, /verbatim|exact/i);
    assert.match(prompt, /responsive|page web|page d’accueil/i);
  }
  assert.equal(result.image_generation_handoff.native_tool, '@Créer une image');
  assert.equal(result.image_generation_handoff.plugin_rendering_available, false);
});
test('long declared copy is not silently truncated out of the image prompt', async () => {
  const message = 'Texte : ' + 'Contenu long. '.repeat(60) + '« TEXTE-FINAL-À-CONSERVER »';
  const result = await generateDirections({ ...brief, design_context: { ...brief.design_context, message } });
  for (const route of result.routes) {
    assert.ok(route.concept_board_prompt.includes('TEXTE-FINAL-À-CONSERVER'));
    assert.ok(route.concept_board_prompt.includes(brief.must_avoid[0]));
  }
});
for (const question of [
  'Deux variantes seulement, exactement 60 minutes, tests à 24 et 48 pixels. Pas trois prototypes ni 45–90 minutes.',
  'Exactly 2 variants in 60 minutes; test at 24 and 48 px. Do not propose 3 variants or 45–90 minutes.'
]) {
  test(`coaching follows declared numeric constraints: ${question.slice(0, 20)}`, () => {
    const result = coachDecision(question, null, 'Comparer sans inventer de résultats.');
    assert.equal(result.exercise.duration, '60 minutes');
    assert.equal(result.exercise.variant_count, 2);
    assert.deepEqual(result.exercise.sizes_px, [24, 48]);
    assert.equal(result.exercise.schedule.reduce((sum, step) => sum + step.minutes, 0), 60);
    const plan = JSON.stringify([result.exercise, result.acceptance_criteria]);
    assert.doesNotMatch(plan, /trois prototypes|three prototypes|45[–-]90|six vignettes/);
    for (const size of [24, 48]) assert.ok(result.acceptance_criteria.some(text => text.includes(`${size} px`)));
    assert.ok(Object.values(result.design_workflow.evaluations).every(item => item.status === 'non_testé'));
  });
}
test('coaching never silently resolves contradictory positive constraints', () => {
  const result = coachDecision('Deux variantes en 60 minutes, puis quatre variantes en 30 minutes.');
  assert.equal(result.exercise.constraint_status, 'ambiguous');
  assert.equal(result.exercise.variant_count, null);
  assert.equal(result.exercise.duration_minutes, null);
  assert.deepEqual(result.exercise.schedule, []);
});
test('coaching with no explicit sizes or time does not invent declared constraints', () => {
  const result = coachDecision('Comment comparer ces propositions ?');
  assert.equal(result.exercise.duration_minutes, null);
  assert.deepEqual(result.exercise.sizes_px, []);
  assert.equal(result.exercise.variant_count, null);
});
test('no reference means unscored differentiation, partial denominator and no originality advice', () => {
  const result = critiqueImageMetrics(metrics);
  assert.equal(result.axes.differentiation.score, null);
  assert.equal(result.axes.differentiation.status, 'non_evaluable');
  assert.equal(result.score_max, 80);
  assert.equal(result.grade, null);
  assert.deepEqual(result.excluded_axes, ['differentiation']);
  assert.ok(!result.priority_axes.includes('differentiation'));
  assert.ok(result.priority_actions.every(action => !action.includes('Changer la silhouette')));
  assert.equal(result.score, Math.round(Object.values(result.axes).reduce((sum, item) => sum + (item.score ?? 0), 0) * 10) / 10);
});
test('provided reference enables only a relative heuristic, not a corpus-level originality claim', () => {
  const result = critiqueImageMetrics(metrics, { risk_score: 100 });
  assert.equal(result.axes.differentiation.score, 0);
  assert.equal(result.axes.differentiation.status, 'heuristic');
  assert.equal(result.score_max, 100);
  assert.deepEqual(result.excluded_axes, []);
  assert.match(result.axes.differentiation.measurement_note, /référence/);
});
test('coach ignores null, nonfinite and unavailable axes even in supplied critiques', () => {
  const result = coachDecision('Deux variantes en 60 minutes à 24 et 48 px.', { axes: {
    differentiation: { score: null, status: 'non_evaluable' }, hierarchy: { score: 12, label: 'Hiérarchie' }, legibility: { score: NaN }
  } });
  assert.doesNotMatch(result.diagnosis, /Différenciation|legibility/);
  assert.match(result.diagnosis, /Hiérarchie/);
  assert.equal(result.exercise.variant_count, 2);
});
