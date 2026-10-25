"""Replay the five unchanged live Boulet test inputs, not rephrased examples."""
import asyncio
import json
from pathlib import Path
import pytest
import fallback_server
import core

CASES = json.loads((Path(__file__).parent / 'fixtures/boulet_cases.json').read_text())

@pytest.mark.parametrize('case', CASES, ids=lambda c:c['id'])
def test_original_boulet_requests(case):
    result=asyncio.run(fallback_server._execute_tool(case['tool'],case['args']))
    data=result['data']
    actual={'routes':len(data.get('routes',[])), 'stages':len(data['design_workflow']['stages']), 'mode':data['intent_resolution']['mode'], 'status':data['intent_resolution']['status']}
    for key,value in case['expected'].items():
        assert actual[key]==value
    if actual['status']=='clarification_required':
        assert data['routes']==[]
        assert data['image_generation_handoff']['ready'] is False
        assert data['intent_resolution']['clarifications']
    for route in data.get('routes',[]):
        for lock in case['args'].get('execution',{}).get('locked_elements',[]):
            assert lock in route['concept_board_prompt']

@pytest.mark.parametrize('question', ['Deux propositions en 60 minutes, tests à 24 et 48 px.','Two proposals in 60 minutes, test at 24 and 48 px.'])
def test_coach_respects_the_same_quantity_vocabulary(question):
    data=core.coach_decision(question)
    assert data['exercise']['variant_count']==2
    assert data['exercise']['duration_minutes']==60
    assert data['exercise']['sizes_px']==[24,48]
    assert data['intent_resolution']['status']=='resolved'

@pytest.mark.parametrize('request_text', ['Pas de propositions.','No proposals.'])
def test_no_proposals_cannot_be_overridden_by_count(request_text):
    data=core.generate_directions({'request':request_text,'execution':{'variant_count':2}})
    assert data['intent_resolution']['status']=='clarification_required'
    assert data['routes']==[]
