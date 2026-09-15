import { POS_LABELS } from './vocabulary';

export const WORD_FAMILY_MAP = {
  create: { v: 'create', n: 'creation', adj: 'creative', adv: 'creatively' },
  creative: { v: 'create', n: 'creation', adj: 'creative', adv: 'creatively' },
  creation: { v: 'create', n: 'creation', adj: 'creative', adv: 'creatively' },
  creatively: { v: 'create', n: 'creation', adj: 'creative', adv: 'creatively' },

  beauty: { n: 'beauty', v: 'beautify', adj: 'beautiful', adv: 'beautifully' },
  beautiful: { n: 'beauty', v: 'beautify', adj: 'beautiful', adv: 'beautifully' },
  beautifully: { n: 'beauty', v: 'beautify', adj: 'beautiful', adv: 'beautifully' },

  honest: { adj: 'honest', adv: 'honestly', n: 'honesty', v: 'honor' },
  honesty: { adj: 'honest', adv: 'honestly', n: 'honesty', v: 'honor' },
  honestly: { adj: 'honest', adv: 'honestly', n: 'honesty', v: 'honor' },

  care: { n: 'care', v: 'care', adj: 'careful', adv: 'carefully' },
  careful: { n: 'care', v: 'care', adj: 'careful', adv: 'carefully' },
  carefully: { n: 'care', v: 'care', adj: 'careful', adv: 'carefully' },

  compete: { v: 'compete', n: 'competition', adj: 'competitive', adv: 'competitively' },
  competition: { v: 'compete', n: 'competition', adj: 'competitive', adv: 'competitively' },
  competitive: { v: 'compete', n: 'competition', adj: 'competitive', adv: 'competitively' },
  competitively: { v: 'compete', n: 'competition', adj: 'competitive', adv: 'competitively' },

  decide: { v: 'decide', n: 'decision', adj: 'decisive', adv: 'decisively' },
  decision: { v: 'decide', n: 'decision', adj: 'decisive', adv: 'decisively' },
  decisive: { v: 'decide', n: 'decision', adj: 'decisive', adv: 'decisively' },
  decisively: { v: 'decide', n: 'decision', adj: 'decisive', adv: 'decisively' },

  educate: { v: 'educate', n: 'education', adj: 'educational', adv: 'educationally' },
  education: { v: 'educate', n: 'education', adj: 'educational', adv: 'educationally' },
  educator: { v: 'educate', n: 'education', adj: 'educational', adv: 'educationally' },

  employ: { v: 'employ', n: 'employment', adj: 'employable', adv: 'employed' },
  employment: { v: 'employ', n: 'employment', adj: 'employable', adv: 'employed' },
  unemployed: { v: 'employ', n: 'unemployment', adj: 'unemployed', adv: 'employed' },

  perform: { v: 'perform', n: 'performance', adj: 'performative', adv: 'performatively' },
  performance: { v: 'perform', n: 'performance', adj: 'performative', adv: 'performatively' },
  performer: { v: 'perform', n: 'performance', adj: 'performative', adv: 'performatively' },

  predict: { v: 'predict', n: 'prediction', adj: 'predictable', adv: 'predictably' },
  prediction: { v: 'predict', n: 'prediction', adj: 'predictable', adv: 'predictably' },

  manage: { v: 'manage', n: 'management', adj: 'managerial', adv: 'manageably' },
  management: { v: 'manage', n: 'management', adj: 'managerial', adv: 'manageably' },

  differ: { v: 'differ', n: 'difference', adj: 'different', adv: 'differently' },
  different: { v: 'differ', n: 'difference', adj: 'different', adv: 'differently' },
  differently: { v: 'differ', n: 'difference', adj: 'different', adv: 'differently' },
  difference: { v: 'differ', n: 'difference', adj: 'different', adv: 'differently' },

  success: { n: 'success', v: 'succeed', adj: 'successful', adv: 'successfully' },
  successful: { n: 'success', v: 'succeed', adj: 'successful', adv: 'successfully' },
  successfully: { n: 'success', v: 'succeed', adj: 'successful', adv: 'successfully' },
  succeed: { n: 'success', v: 'succeed', adj: 'successful', adv: 'successfully' },

  friend: { n: 'friend', v: 'befriend', adj: 'friendly', adv: 'friendlily' },
  friendly: { n: 'friend', v: 'befriend', adj: 'friendly', adv: 'friendlily' },

  help: { n: 'help', v: 'help', adj: 'helpful', adv: 'helpfully' },
  helpful: { n: 'help', v: 'help', adj: 'helpful', adv: 'helpfully' },
  helpfully: { n: 'help', v: 'help', adj: 'helpful', adv: 'helpfully' },

  hope: { n: 'hope', v: 'hope', adj: 'hopeful', adv: 'hopefully' },
  hopeful: { n: 'hope', v: 'hope', adj: 'hopeful', adv: 'hopefully' },
  hopefully: { n: 'hope', v: 'hope', adj: 'hopeful', adv: 'hopefully' },

  act: { v: 'act', n: 'action', adj: 'active', adv: 'actively' },
  action: { v: 'act', n: 'action', adj: 'active', adv: 'actively' },
  active: { v: 'act', n: 'action', adj: 'active', adv: 'actively' },
  actively: { v: 'act', n: 'action', adj: 'active', adv: 'actively' },

  attract: { v: 'attract', n: 'attraction', adj: 'attractive', adv: 'attractively' },
  attraction: { v: 'attract', n: 'attraction', adj: 'attractive', adv: 'attractively' },
  attractive: { v: 'attract', n: 'attraction', adj: 'attractive', adv: 'attractively' },
  attractively: { v: 'attract', n: 'attraction', adj: 'attractive', adv: 'attractively' },

  comfort: { n: 'comfort', v: 'comfort', adj: 'comfortable', adv: 'comfortably' },
  comfortable: { n: 'comfort', v: 'comfort', adj: 'comfortable', adv: 'comfortably' },
  comfortably: { n: 'comfort', v: 'comfort', adj: 'comfortable', adv: 'comfortably' },

  danger: { n: 'danger', v: 'endanger', adj: 'dangerous', adv: 'dangerously' },
  dangerous: { n: 'danger', v: 'endanger', adj: 'dangerous', adv: 'dangerously' },
  dangerously: { n: 'danger', v: 'endanger', adj: 'dangerous', adv: 'dangerously' },

  depend: { v: 'depend', n: 'dependence', adj: 'dependent', adv: 'dependently' },
  dependent: { v: 'depend', n: 'dependence', adj: 'dependent', adv: 'dependently' },

  express: { v: 'express', n: 'expression', adj: 'expressive', adv: 'expressively' },
  expression: { v: 'express', n: 'expression', adj: 'expressive', adv: 'expressively' },

  health: { n: 'health', v: 'heal', adj: 'healthy', adv: 'healthily' },
  healthy: { n: 'health', v: 'heal', adj: 'healthy', adv: 'healthily' },

  impress: { v: 'impress', n: 'impression', adj: 'impressive', adv: 'impressively' },
  impression: { v: 'impress', n: 'impression', adj: 'impressive', adv: 'impressively' },
  impressive: { v: 'impress', n: 'impression', adj: 'impressive', adv: 'impressively' },

  inform: { v: 'inform', n: 'information', adj: 'informative', adv: 'informatively' },
  information: { v: 'inform', n: 'information', adj: 'informative', adv: 'informatively' },

  invent: { v: 'invent', n: 'invention', adj: 'inventive', adv: 'inventively' },
  invention: { v: 'invent', n: 'invention', adj: 'inventive', adv: 'inventively' },

  nature: { n: 'nature', v: 'naturalize', adj: 'natural', adv: 'naturally' },
  natural: { n: 'nature', v: 'naturalize', adj: 'natural', adv: 'naturally' },
  naturally: { n: 'nature', v: 'naturalize', adj: 'natural', adv: 'naturally' },

  peace: { n: 'peace', v: 'pacify', adj: 'peaceful', adv: 'peacefully' },
  peaceful: { n: 'peace', v: 'pacify', adj: 'peaceful', adv: 'peacefully' },

  person: { n: 'person', v: 'personalize', adj: 'personal', adv: 'personally' },
  personal: { n: 'person', v: 'personalize', adj: 'personal', adv: 'personally' },
  personally: { n: 'person', v: 'personalize', adj: 'personal', adv: 'personally' },

  protect: { v: 'protect', n: 'protection', adj: 'protective', adv: 'protectively' },
  protection: { v: 'protect', n: 'protection', adj: 'protective', adv: 'protectively' },

  safe: { adj: 'safe', n: 'safety', adv: 'safely', v: 'save' },
  safety: { adj: 'safe', n: 'safety', adv: 'safely', v: 'save' },
  safely: { adj: 'safe', n: 'safety', adv: 'safely', v: 'save' },

  science: { n: 'science', v: 'systematize', adj: 'scientific', adv: 'scientifically' },
  scientific: { n: 'science', v: 'systematize', adj: 'scientific', adv: 'scientifically' },

  separate: { adj: 'separate', v: 'separate', n: 'separation', adv: 'separately' },
  separately: { adj: 'separate', v: 'separate', n: 'separation', adv: 'separately' },

  tradition: { n: 'tradition', v: 'traditionalize', adj: 'traditional', adv: 'traditionally' },
  traditional: { n: 'tradition', v: 'traditionalize', adj: 'traditional', adv: 'traditionally' },
  traditionally: { n: 'tradition', v: 'traditionalize', adj: 'traditional', adv: 'traditionally' },

  use: { n: 'use', v: 'use', adj: 'useful', adv: 'usefully' },
  useful: { n: 'use', v: 'use', adj: 'useful', adv: 'usefully' },
  usefully: { n: 'use', v: 'use', adj: 'useful', adv: 'usefully' },

  communicate: { v: 'communicate', n: 'communication', adj: 'communicative', adv: 'communicatively' },
  communication: { v: 'communicate', n: 'communication', adj: 'communicative', adv: 'communicatively' },

  patient: { adj: 'patient', n: 'patience', adv: 'patiently', v: 'persevere' },
  patiently: { adj: 'patient', n: 'patience', adv: 'patiently', v: 'persevere' },

  confident: { adj: 'confident', n: 'confidence', adv: 'confidently', v: 'confide' },
  confidently: { adj: 'confident', n: 'confidence', adv: 'confidently', v: 'confide' },

  anxious: { adj: 'anxious', n: 'anxiety', adv: 'anxiously', v: 'worry' },
  anxiously: { adj: 'anxious', n: 'anxiety', adv: 'anxiously', v: 'worry' },

  generous: { adj: 'generous', n: 'generosity', adv: 'generously', v: 'give' },
  generously: { adj: 'generous', n: 'generosity', adv: 'generously', v: 'give' },

  polite: { adj: 'polite', n: 'politeness', adv: 'politely', v: 'honor' },
  politely: { adj: 'polite', n: 'politeness', adv: 'politely', v: 'honor' },

  relax: { v: 'relax', n: 'relaxation', adj: 'relaxed', adv: 'relaxedly' },
  relaxed: { v: 'relax', n: 'relaxation', adj: 'relaxed', adv: 'relaxedly' },

  simple: { adj: 'simple', n: 'simplicity', adv: 'simply', v: 'simplify' },
  simply: { adj: 'simple', n: 'simplicity', adv: 'simply', v: 'simplify' },

  quick: { adj: 'quick', n: 'quickness', adv: 'quickly', v: 'quicken' },
  quickly: { adj: 'quick', n: 'quickness', adv: 'quickly', v: 'quicken' },

  clear: { adj: 'clear', n: 'clarity', adv: 'clearly', v: 'clarify' },
  clearly: { adj: 'clear', n: 'clarity', adv: 'clearly', v: 'clarify' },

  real: { adj: 'real', n: 'reality', adv: 'really', v: 'realize' },
  really: { adj: 'real', n: 'reality', adv: 'really', v: 'realize' },
};

export function deriveMorphologicalFamily(term, pos = 'other') {
  const clean = term.trim().toLowerCase();

  let base = clean;
  if (base.endsWith('fully')) base = base.slice(0, -5);
  else if (base.endsWith('ily')) base = base.slice(0, -3) + 'y';
  else if (base.endsWith('ly')) base = base.slice(0, -2);
  else if (base.endsWith('tion') || base.endsWith('sion')) base = base.slice(0, -4);
  else if (base.endsWith('ment')) base = base.slice(0, -4);
  else if (base.endsWith('ness')) base = base.slice(0, -4);
  else if (base.endsWith('ity')) base = base.slice(0, -3);
  else if (base.endsWith('ful') || base.endsWith('less')) base = base.slice(0, -3);
  else if (base.endsWith('able') || base.endsWith('ible')) base = base.slice(0, -4);
  else if (base.endsWith('ive')) base = base.slice(0, -3);
  else if (base.endsWith('ous')) base = base.slice(0, -3);
  else if (base.endsWith('ize') || base.endsWith('ise')) base = base.slice(0, -3);

  if (!base || base.length < 2) base = clean;

  const n = base.endsWith('e') ? (base.slice(0, -1) + 'ation') : (base + 'ness');
  const v = base.endsWith('e') ? base : (base + 'e');
  const adj = base.endsWith('e') ? (base.slice(0, -1) + 'ive') : (base + 'ful');
  const adv = adj.endsWith('e') ? (adj + 'ly') : (adj + 'ly');

  const family = { n, v, adj, adv };
  if (pos && family[pos]) {
    family[pos] = clean;
  }
  return family;
}

export function getWordFamily(term, pos = 'other') {
  const key = term.trim().toLowerCase();
  if (WORD_FAMILY_MAP[key]) {
    return { ...WORD_FAMILY_MAP[key] };
  }
  return deriveMorphologicalFamily(term, pos);
}

export function makeWordFamilyChoices(currentWord, allWords = []) {
  if (!currentWord || !currentWord.term) return [];
  const targetTerm = currentWord.term.trim();
  const targetPos = currentWord.partOfSpeech || 'other';
  const family = getWordFamily(targetTerm, targetPos);

  const desiredPositions = ['v', 'n', 'adj', 'adv'];
  const choices = [];

  let matchedPos = null;
  for (const p of desiredPositions) {
    if (family[p] && family[p].toLowerCase() === targetTerm.toLowerCase()) {
      matchedPos = p;
      break;
    }
  }
  if (!matchedPos) {
    matchedPos = targetPos !== 'other' ? targetPos : 'v';
    family[matchedPos] = targetTerm;
  }

  for (const posKey of desiredPositions) {
    const wordForm = family[posKey] || (targetTerm + ' (' + posKey + ')');
    choices.push({
      term: wordForm,
      partOfSpeech: posKey,
      posLabel: POS_LABELS[posKey] || posKey.toUpperCase(),
      isCorrect: posKey === matchedPos,
    });
  }

  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = choices[i];
    choices[i] = choices[j];
    choices[j] = temp;
  }

  return choices;
}
