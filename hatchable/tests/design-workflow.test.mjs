import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_PRINCIPLES } from '../lib/design-principles-data.js';
import { buildDesignWorkflow, searchPrinciples, normalizeDesignContext } from '../lib/design-workflow.js';
import { searchDesignSystems, generateDirections, coachDecision, critiqueImageMetrics, executeTool } from '../lib/core.js';
import { TOOLS } from '../lib/contract.js';

const titles = [
  'Définir la tâche, le public, le message, le support et la taille finale.',
  'Déterminer ce que le visuel doit représenter correctement.',
  'Appliquer les contraintes de reproduction et d’accessibilité pertinentes.',
  'Choisir les principes perceptifs qui clarifient la structure.',
  'Explorer plusieurs systèmes de proportion et de composition.',
  'Développer la direction artistique et les références symboliques.',
  'Effectuer les corrections optiques et les déclinaisons.',
  'Évaluer séparément reconnaissance, compréhension et préférence.'
];

test('all 150 complete principle cards are reachable by ID with resolved sources', () => {
  const result = searchPrinciples('', 100);
  assert.equal(result.total_matches, 150);
  assert.equal(result.items.length, 25);
  assert.deepEqual(result.catalogue_counts, { concepts: 150, sources: 69, domains: 14 });
  const sources = new Map(DESIGN_PRINCIPLES.sources.map(source => [source.id, source]));
  for (const concept of DESIGN_PRINCIPLES.concepts) {
    const card = searchPrinciples(concept.id, 1).items[0];
    assert.equal(card.id, concept.id);
    for (const [key, value] of Object.entries(concept)) assert.deepEqual(card[key], value);
    assert.ok(card.basis_label);
    assert.deepEqual(card.sources.map(source => source.id), concept.source_ids);
    for (const source of card.sources) {
      for (const [key, value] of Object.entries(sources.get(source.id))) assert.deepEqual(source[key], value);
      assert.ok(source.read_level);
    }
  }
});

test('aliases and accents preserve useful matches; nonempty unsearchable input returns none', () => {
  for (const queries of [['fibonaci', 'FIBONACCI'], ['golden ratio', 'nombre d’or', "nombre d'or", 'φ', 'ϕ', 'Φ', 'phi'], ['sacred geometry', 'géométrie sacrée', 'GEOMETRIE SACREE']]) {
    const ids = searchPrinciples(queries[0], 25).items.map(item => item.id);
    assert.ok(ids.length);
    for (const query of queries.slice(1)) assert.deepEqual(searchPrinciples(query, 25).items.map(item => item.id), ids);
  }
  assert.equal(searchPrinciples('φ', 1).items[0].id, 'GEO-09');
  for (const query of ['qxzvnjk987654321', '🪷', '比例', '!!!']) {
    const result = searchPrinciples(query);
    assert.equal(result.total_matches, 0);
    assert.deepEqual(result.items, []);
  }
});

test('normative exceptions and symbolic scope stay visible in complete cards', () => {
  const text = searchPrinciples('INF-14', 1).items[0];
  assert.match(text.definition, /4\.5/);
  assert.match(text.limits, /4\.499/);
  assert.match(text.limits, /Exceptions/);
  assert.ok(text.sources.every(source => source.read_level));
  assert.match(searchPrinciples('INF-32', 1).items[0].definition, /AAA/);
  assert.equal(searchPrinciples('THE-07', 1).items[0].basis, 'historical_symbolic');
});

test('exact eight-stage order has valid IDs and no fabricated results', () => {
  const plan = buildDesignWorkflow(), ids = new Set(DESIGN_PRINCIPLES.concepts.map(item => item.id));
  assert.deepEqual(plan.stages.map(stage => stage.title), titles);
  assert.equal(new Set(plan.stages.map(stage => stage.id)).size, 8);
  assert.ok(plan.stages.every(stage => stage.status === 'non_testé' && stage.checks.length && stage.principle_ids.every(id => ids.has(id))));
  for (const result of Object.values(plan.evaluations)) {
    assert.equal(result.status, 'non_testé');
    assert.deepEqual(result.evidence, []);
    assert.deepEqual(result.observations, []);
  }
  assert.equal(plan.evidence_contract.automatic_validation, false);
  assert.equal(plan.evidence_contract.accepts_evidence, false);
});

test('context bounds, precedence, absent facts and result isolation', () => {
  assert.deepEqual(buildDesignWorkflow().brief, {});
  assert.equal(buildDesignWorkflow().missing_brief.length, 6);
  const plan = buildDesignWorkflow({ audience: '  Experts  du dessin ', medium: 'Imprimé' }, { audience: 'Public fourni', promise: 'Montrer les relations' });
  assert.equal(plan.brief.audience, 'Experts du dessin');
  assert.equal(plan.brief_sources.audience, 'design_context.audience');
  assert.equal(plan.brief_sources.message, 'promise');
  assert.ok(plan.missing_brief.includes('task'));
  assert.equal(normalizeDesignContext({ audience: 'x'.repeat(400) }).audience.length, 400);
  for (const value of [{ audience: 'x'.repeat(401) }, { task: 42 }, { medium: null }, [], 'web', { evidence: [] }, { status: 'satisfait' }]) assert.throws(() => normalizeDesignContext(value));
  plan.stages[0].status = 'satisfait';
  plan.evaluations.recognition.evidence.push('unverified claim');
  assert.equal(buildDesignWorkflow().stages[0].status, 'non_testé');
  assert.deepEqual(buildDesignWorkflow().evaluations.recognition.evidence, []);
});

test('existing public library view serves principles and preserves historical search', async () => {
  const result = await executeTool('search_design_systems', { query: 'golden ratio', kind: 'principle', limit: 2 });
  assert.equal(result.view, 'library');
  assert.equal(result.data.collection, 'design_principles');
  assert.equal(result.data.items[0].id, 'GEO-09');
  assert.equal((await searchDesignSystems('NASA')).items[0].name, 'NASA Graphics Standards Program');
});

test('directions retain host handoff and do not treat generated audience defaults as declarations', async () => {
  const brief = { name: 'Atelier', sector: 'architecture', promise: 'Précision humaine' };
  const plain = await generateDirections(brief);
  const supplied = (await executeTool('generate_brand_directions', { ...brief, design_context: { audience: 'Architectes', final_size: '1080 × 1350 px' } })).data;
  assert.deepEqual(supplied.image_generation_handoff, plain.image_generation_handoff);
  assert.equal(plain.image_generation_handoff.native_tool, '@Créer une image');
  assert.equal(plain.brief.audience, 'public général');
  assert.ok(plain.design_workflow.missing_brief.includes('audience'));
  assert.equal(supplied.brief.audience, 'Architectes');
  assert.deepEqual(supplied.routes.map(route => route.id), ['symbol', 'type', 'system']);
  assert.ok(supplied.routes.every(route => route.concept_board_prompt.length > 100));
});

test('coaching does not reinterpret a critique as human-study evidence', async () => {
  const critique = { axes: { memorability: { score: 19, label: 'Old memorability label' } }, evaluations: { recognition: { status: 'satisfait', evidence: ['unverified claim'] } } };
  const result = (await executeTool('coach_brand_decision', { question: 'Que vérifier ?', critique, design_context: { task: 'Comparer les valeurs' } })).data;
  assert.deepEqual(result.design_workflow.brief, { task: 'Comparer les valeurs' });
  assert.equal(result.design_workflow.stages.length, 8);
  assert.deepEqual(coachDecision('Question').design_workflow.brief, {});
  assert.ok(Object.values(result.design_workflow.evaluations).every(item => item.status === 'non_testé' && item.evidence.length === 0));
});

test('critique scores available axes and declares heuristic and untested human scope', () => {
  const metrics = { foreground_occupancy: .3, centroid: { x: .5, y: .5 }, balance: .8, saliency_concentration: .4, edge_density: .15, contrast: .3, small_size_stability: .8, entropy: .6 };
  const result = critiqueImageMetrics(metrics);
  assert.equal(Object.keys(result.axes).length, 5);
  assert.equal(result.score, Math.round(Object.values(result.axes).reduce((sum, item) => sum + (item.score ?? 0), 0) * 10) / 10);
  assert.equal(result.score_kind, 'heuristic_proxy');
  assert.match(result.axes.memorability.label, /proxy/);
  assert.equal(result.axes.memorability.basis, 'heuristic');
  assert.ok(Object.values(result.evaluations).every(item => item.status === 'non_testé'));
});

test('design context is optional and bounded on the same existing public tools', () => {
  assert.equal(TOOLS.length, 9);
  for (const name of ['generate_brand_directions', 'coach_brand_decision']) {
    const tool = TOOLS.find(item => item.name === name), context = tool.inputSchema.properties.design_context;
    assert.ok(!tool.inputSchema.required.includes('design_context'));
    assert.equal(context.additionalProperties, false);
    assert.equal(context.properties.audience.maxLength, 400);
    assert.equal(context.properties.final_size.maxLength, 160);
  }
  assert.ok(!Object.hasOwn(TOOLS.find(item => item.name === 'generate_brand_directions').inputSchema.properties.audience, 'default'));
});
